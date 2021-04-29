/**
 * Copyright (c) 2020 OTT Hydromet Fellbach GmbH
 *
 * Node-Red UMB channels
 *
 * @summary Node-Red UMB parser
 * @author Martin Kiepfer <martin.kiepfer@otthydromet.com>
 */
let mod_umbparser = require('./umbparser');
var umb_channels = {
    name: {value: "WS10"},
    channels: {value: [
        {enabled:true, ch:"100", chname:"Temperature", unit:"°C"},
        {enabled:true, ch:"200", chname:"Rel. Humidity", unit:"%"},
        {enabled:true, ch:"300", chname:"Air Pressure", unit:"hPa"},
        {enabled:true, ch:"400", chname:"Wind Speed", unit:"m/s"},
        {enabled:true, ch:"405", chname:"Wind Speed", unit:"km/h"},
        {enabled:true, ch:"500", chname:"Wind Direction", unit:"°"},
        {enabled:true, ch:"600", chname:"Precipiation amount", unit:"mm"},
        {enabled:true, ch:"601", chname:"Precipiation amount daily", unit:"mm"},
        {enabled:true, ch:"700", chname:"Precipiation type", unit:"digit"},
        {enabled:true, ch:"900", chname:"Global Radiation", unit:"W/m^2"},
        {enabled:true, ch:"903", chname:"Illumination", unit:"klx"},
        {enabled:true, ch:"904", chname:"Dawn", unit:"lx"},
        {enabled:true, ch:"910", chname:"Sun Direction Azimut", unit:"°"},
        {enabled:true, ch:"911", chname:"Sun Direction Elevation", unit:"°"},
    ]},
};

module.exports = function(RED) {
    function UMBChannels(config) {
        RED.nodes.createNode(this, config);
        this.channels = config.channels;
        var node = this;
    }
    RED.nodes.registerType("umbchannels", UMBChannels);
}
