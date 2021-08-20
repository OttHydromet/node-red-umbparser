/**
 * Copyright (c) 2020 OTT Hydromet Fellbach GmbH
 *
 * UMB handler class
 *
 * @summary UMB handler class
 * @author Martin Kiepfer <martin.kiepfer@otthydromet.com>
 */

const net = require('net');
let mod_umbparser = require('./umbparser');
const { throws } = require('assert');
const { EventEmitter } = require('events');
const { resolve } = require('path');
const umb_consts = require('./umb_consts').umb_consts;

let l_socket_id = 0;
let l_client = undefined;
let l_emitter = undefined; 

const UMBSocketStatus = {
    created: "created",
    closed: "closed",
    error: "error",
    undefined: "undefined",
    connected: "connected"
}

class UMBSocket extends net.Socket
{
    constructor(node, emitter)
    {
        super();

        l_emitter = emitter;
        this.node = node;
        this.socket_status = UMBSocketStatus.created;
        this.umbparser = new mod_umbparser.UMBParser(this.node);
        this.id = l_socket_id++;

        this.node.log("[" + this.id + "] Socket created");

        this.setNoDelay(true);
        this.on('error', (ex) => {
            this.node.log("[" + this.id + "] Socket error (" + ex + ")");
            this.node.log(ex);
            this.socket_status = UMBSocketStatus.error;
            l_emitter.emit('finished', 'Socket error');
        });
        this.on('close', (hadError) => {
            this.node.log("[" + this.id + "] Socket closed (Error: " + hadError + ")");
            this.socket_status = UMBSocketStatus.closed;
            l_emitter.emit('finished', 'Socket closed');
            this.node.status({fill:"red",shape:"ring",text:"disconnected"});
        });
        this.on('connect', () => {
            this.node.log("[" + this.id + "] Socket connected");
            this.socket_status = UMBSocketStatus.connected;
            l_emitter.emit('connected', 'Socket connected');
            this.node.status({fill:"green",shape:"ring",text:"connected"});
        })
        this.on('data', (data) => {
            this.node.log("[" + this.id + "] Socket RX: " + data.length + "bytes");
            
            this.node.log("Valid input buffer detected");
            let parsedFrame = this.umbparser.ParseReadBuf(data);

            this.node.log("Parsing status:")
            this.node.log("parser status: " + parsedFrame.parserState);
            if(parsedFrame.parserState == "finished")
            {
                this.node.log("Frametype: " + parsedFrame.umbframe.type);
                this.node.log("Framestatus: " + parsedFrame.umbframe.status);
                this.node.log("Framecmd: " + parsedFrame.umbframe.cmd);
                l_emitter.emit('finished', parsedFrame);
            }
            else if(parsedFrame.parserState == "processing")
            {
                this.node.log("processing...");
            }
        });

        this.node.status({fill:"red",shape:"ring",text:"disconnected"});
    }
}

class UMBHandler
{
    /**
     * 
     * @param {node} node 
     * @param {int} address 
     * @param {string} ip_port 
     * @param {int} ip_address 
     */
    constructor(node, address, ip_port, ip_address)
    {   
        var self = this;

        this.node = node;
        this.address = address;
        this.ip_port = ip_port;
        this.ip_address = ip_address;

        this.cb_result = undefined;

        if(l_emitter == undefined) {
            l_emitter= new EventEmitter();
        }

        if(l_client == undefined) {
            l_client = new UMBSocket(this.node, l_emitter);
        }
    }

    async syncTransfer(umbreq)
    {
        let fnct_retval = undefined;
        let num_retries = 0;

        this.node.log("TX start (length:" + umbreq.length + ")");

        while(fnct_retval == undefined) {

            // make sure socket is connected
            switch(l_client.socket_status) 
            {
                case UMBSocketStatus.connected:
                    // Socket already connected. Nothing to do here

                    // transfer
                    await new Promise( (resolve, reject) => {
                        this.node.log("TX: " + umbreq.length);
                        l_client.setTimeout(umb_consts.UMB_TIMEOUT.TIMEOUT_LONG*2, () => {
                            this.node.log("Data timeout");
                            l_emitter.emit('finished', "Data timeout");
                        });
                        l_emitter.on('finished', (result) => {
                            this.node.log("Socket event received (" + result + ")");
                            l_client.setTimeout(0);
                            resolve(result);
                        });
                        l_client.write(umbreq);
                    }).then( (result) => {
                        l_emitter.removeAllListeners("finished");
                        if (result == "Data timeout")
                        {
                            this.node.log("Data timeout #" + num_retries)
                            num_retries++;
                            if (num_retries > 3) {
                                fnct_retval = "Data Timeout";
                            }
                        }
                        else if ((result.umbframe != undefined) && (result.parserState != undefined)) {
                            fnct_retval = result;
                        }
                        else {
                            fnct_retval = result;
                        }
                    });
                    
                    break;
                case UMBSocketStatus.error:
                    // Socket error
                    fnct_retval = "Socket Error";
                    break;
                case UMBSocketStatus.closed:
                    // Socket is closed. Needs to be recreated
                    this.node.log("Socket closed");
                    //l_client = new UMBSocket(this.node, l_emitter);
                    // >> fallthrough
                case UMBSocketStatus.created:
                    // Socket is created, but needs to be connected
                    this.node.log("Socket created. Connecting...");

                    // wait for connection
                    await new Promise((resolve, reject) => {
                        let conTimeout = setTimeout(() => {
                            this.node.log("Connection timeout");
                            l_emitter.emit('connected', "Connection timeout");
                        }, 5000);
                        l_emitter.on('connected', (result) => {
                            this.node.log("Socket connected received (" + result + ")");
                            clearTimeout(conTimeout);
                            resolve(result);
                        });
                        l_client.connect(this.ip_port, this.ip_address);
                    }).then((result) => {
                        l_emitter.removeAllListeners("connected");
                        if(result == "Connection timeout") {
                            fnct_retval = result;
                        }
                    });
                    
                    break;
                default:
                    this.node.log("Error: undefined socket state!");
                    fnct_retval = "Invalid socket state";
                    break;
            }
        }

        this.node.log("TX end (" + fnct_retval + ")");

        return fnct_retval;
    }
}

module.exports.UMBHandler = UMBHandler;
