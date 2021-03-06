/**
 * Copyright (c) 2020 OTT Hydromet Fellbach GmbH
 *
 * Node-Red UMB parser
 *
 * @summary Node-Red UMB parser
 * @author Martin Kiepfer <martin.kiepfer@otthydromet.com>
 */
let mod_umbhandler = require('./umbhandler');
let mod_umbparser = require('./umbparser');

const { parse, resolve } = require('path');
const { promises } = require('fs');
const { memory } = require('console');
const umb_consts = require('./umb_consts').umb_consts;
const serialport = require('serialport')

var l_node = undefined;
var l_umbhandler;
var l_cur_config;

var umb_channels = {
    name: {value: "WS10"},
    channels: {value: [
        {enabled:true, ch:"100", chname:"Temperature", chunit:"°C"},
    ]},
    status: ""
};

const UNIT_SYSTEMS = new Map(
[
    ["°C", "metric"],
    ["°F", "imperial"],
    ["m/s", "metric"],
    ["km/h", "metric"],
    ["mph", "imperial"],
    ["kts", "imperial"],
    ["l/m²", "metric"],
    ["mm", "metric"],
    ["in", "imperial"],
    ["mil", "imperial"],
    ["l/m²/h", "metric"],
    ["mm/h", "metric"],
    ["in/h", "imperial"],
    ["in/m", "imperial"],
    ["mil/h", "imperial"],
]
);

/**
 * Checks if a given unit @cur_unit is withing a given unit system (@cfg_unitsystem). 
 * 
 * @param {string} cur_unit Current unit to be checked (e.g. '°C')
 * @param {string} cfg_unitsystem Current selected unit system (possible values: 'all', 'imperial', 'metric')
 */
function checkUnit(cur_unit, cfg_unitsystem) {
    let cur_unitsystem = UNIT_SYSTEMS.get(cur_unit);
    retval = true;

    if(cfg_unitsystem == "all") {
        retval = true;
    }
    else {
        if( (cfg_unitsystem == cur_unitsystem) 
            || (cur_unitsystem == undefined) ) {
            retval = true;
        }
        else {
            retval = false;
        }
    }
             
    return retval;
}

module.exports = function(RED) {

    function UMBControllerNode(config) {
        RED.nodes.createNode(this, config);

        // BUG: NRU-15 - Communication only working with to-address 0
        l_node = this;
        l_cur_config = config;

        this.cfg_channels = RED.nodes.getNode(config.channels);
        if(this.cfg_channels)
        {
            this.query_channels = [];
            this.cfg_channels.channels.forEach(element => {
                if(element.enabled)
                    this.query_channels.push(element.ch);
            });
        }
        
        let umbgen = new mod_umbparser.UMBGenerator(this);
        l_umbhandler = new mod_umbhandler.UMBHandler(l_node, parseInt(config.dev_address, 16), config.com_intf, { 
            ip_address: config.ip_address, 
            ip_port:    config.ip_port,
            sp_tty:     config.sp_tty,
            sp_baud:    config.sp_baud,
            sp_parity:  config.sp_parity,
        });

        l_node.on('input', function(msg) {
            let umbreq = umbgen.createMultiChReq(parseInt(config.dev_address, 16), this.query_channels);
            
            l_umbhandler.syncTransfer(umbreq).then((response) => {
                let retmsg = new Object;
                retmsg.payload = response;
                l_node.send(retmsg);
            });
        });
    }
    RED.nodes.registerType("umbcontroller", UMBControllerNode);

    // Register internal URL to list serial port configurations
    RED.httpAdmin.get("/ttys", RED.auth.needsPermission('serialport.list'), function(req,res) {
        
        l_node.log("tty list: ");

        serialport.list().then( (ports) => {
            var tty_list = [];
            ports.forEach(cur_tty => {
                console.log(cur_tty);
                tty_list.push(cur_tty.path);
            });
            res.json(tty_list);
        }, (err) => {
            console.error(err);
                res.json("");

        });
        
    });

    // Register internal URL to query channel list (used by channel_list config node)
    RED.httpAdmin.get("/umbchannels", RED.auth.needsPermission('umbchannels.read'), function(req,res) {
        let umbgen = new mod_umbparser.UMBGenerator(l_node);
        
        let cfg_unitsystem = new URLSearchParams(req.url).get("unitsystem");

        /* 1. query number of blocks and channels */
        new Promise((resolve, reject) => {
            let umbreq = umbgen.createChNumReq(parseInt(l_cur_config.dev_address, 16));
            l_umbhandler.syncTransfer(umbreq).then((response) => {
                if(response.umbframe == undefined)
                {
                    l_node.log("Error: " + response);
                    reject("Error: " + response);
                }
                else
                {
                    numChannels = response.umbframe.framedata.parsed.numChannels;
                    l_node.log("channels detected: " + numChannels);
                    resolve(numChannels);
                }
            });
        })
        /* 2. Query channel list */
        .then((parm) => {
            return new Promise((resolve, reject) => {
                let umbreq = umbgen.createChListReq(parseInt(l_cur_config.dev_address, 16), 0);
                l_umbhandler.syncTransfer(umbreq).then((response) => {
                    if(response.umbframe == undefined)
                    {
                        l_node.log("Error: " + response);
                        reject("Error: " + response);
                    }
                    else
                    {
                        l_node.log("Channellist read");
                        channelList = response.umbframe.framedata.parsed.channels;
                        resolve(channelList);
                    }
                });
            })
        })
        /* 3. Query channel details */
        .then((channelList) => {
            return new Promise((resolve, reject) => {

                let channelCfg = new Array();

                (async () => {
                    await channelList.reduce(async (memo, curChannel) => {
                        await memo;
                        let umbreq = umbgen.createChDetailsReq(parseInt(l_cur_config.dev_address, 16), curChannel);
                        await l_umbhandler.syncTransfer(umbreq).then((response) => {
                            if(response.umbframe == undefined)
                            {
                                l_node.log("Error: " + response);
                                reject("Error: " + response);
                                return response;
                            }
                            else
                            {
                                l_node.log("CurChannel: " + curChannel);
                                curChDetails = new Object();
                                curChDetails.enabled = false;
                                curChDetails.ch = curChannel;
                                curChDetails.chname = response.umbframe.framedata.parsed.name;
                                curChDetails.chunit = response.umbframe.framedata.parsed.unit;
                                if(checkUnit(curChDetails.chunit, cfg_unitsystem)) {
                                    channelCfg.push(curChDetails);
                                }
                                else {
                                    l_node.log("skipped");
                                }
                            }
                        });
                    }, undefined);
                    channelCfg;
                    resolve(channelCfg);
                })();
            });
        })
        .then((channelCfg) => {
            umb_channels.channels.value = channelCfg;
            res.json(umb_channels);
        })
        .catch((error) => {
            l_node.log("Error: = " + error);
            umb_channels.error = error;
            res.json(umb_channels);
        });
    });
}
