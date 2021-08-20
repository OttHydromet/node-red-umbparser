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

var node = undefined;
var dev_address = 0;
var ip_address = 0
var ip_port = 0;

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
        dev_address = parseInt(config.dev_address, 16);
        ip_address = config.ip_address;
        ip_port = config.ip_port;
        node = this;

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
        let umbhandler = new mod_umbhandler.UMBHandler(this, dev_address, ip_port, ip_address);

        node.on('input', function(msg) {
            let umbreq = umbgen.createMultiChReq(dev_address, this.query_channels);
            
            umbhandler.syncTransfer(umbreq).then((response) => {
                let retmsg = new Object;
                retmsg.payload = response;
                node.send(retmsg);
            });
        });
    }
    RED.nodes.registerType("umbcontroller", UMBControllerNode);

    // Register internal URL to query channel list (used by channel_list config node)
    RED.httpAdmin.get("/umbchannels", RED.auth.needsPermission('umbchannels.read'), function(req,res) {
        let umbgen = new mod_umbparser.UMBGenerator(node);
        let umbhandler = new mod_umbhandler.UMBHandler(node, dev_address, ip_port, ip_address);

        let cfg_unitsystem = new URLSearchParams(req.url).get("unitsystem");

        /* 1. query number of blocks and channels */
        new Promise((resolve, reject) => {
            let umbreq = umbgen.createChNumReq(dev_address);
            umbhandler.syncTransfer(umbreq).then((response) => {
                if(response.umbframe == undefined)
                {
                    node.log("Error: " + response);
                    reject("Error: " + response);
                }
                else
                {
                    numChannels = response.umbframe.framedata.parsed.numChannels;
                    node.log("channels detected: " + numChannels);
                    resolve(numChannels);
                }
            });
        })
        /* 2. Query channel list */
        .then((parm) => {
            return new Promise((resolve, reject) => {
                let umbreq = umbgen.createChListReq(dev_address, 0);
                umbhandler.syncTransfer(umbreq).then((response) => {
                    if(response.umbframe == undefined)
                    {
                        node.log("Error: " + response);
                        reject("Error: " + response);
                    }
                    else
                    {
                        node.log("Channellist read");
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
                        let umbreq = umbgen.createChDetailsReq(dev_address, curChannel);
                        await umbhandler.syncTransfer(umbreq).then((response) => {
                            if(response.umbframe == undefined)
                            {
                                node.log("Error: " + response);
                                reject("Error: " + response);
                                return response;
                            }
                            else
                            {
                                node.log("CurChannel: " + curChannel);
                                curChDetails = new Object();
                                curChDetails.enabled = false;
                                curChDetails.ch = curChannel;
                                curChDetails.chname = response.umbframe.framedata.parsed.name;
                                curChDetails.chunit = response.umbframe.framedata.parsed.unit;
                                if(checkUnit(curChDetails.chunit, cfg_unitsystem)) {
                                    channelCfg.push(curChDetails);
                                }
                                else {
                                    node.log("skipped");
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
            node.log("Error: = " + error);
            umb_channels.error = error;
            res.json(umb_channels);
        });
    });
}
