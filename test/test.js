const mod_umbparser = require('../umbparser')
const umb_consts = require('../umb_consts').umb_consts;

let assert = require('assert');
let umbparser = new mod_umbparser.UMBParser();

let statusOkResponse = [ 0x01, 0x10, 0x01, 0xF0, 0x01, 0x50, 0x03, 0x02, 0x26, 0x10, 0x00, 0x03, 0x4D, 0xF7, 0x04 ];
let status55Response = [ 0x01, 0x10, 0x01, 0xF0, 0x01, 0x50, 0x03, 0x02, 0x26, 0x10, 0x55, 0x03, 0x02, 0x5A, 0x04 ];

let onlineCmdResponse_2ValOk = [ 0x01, 0x10, 0x01, 0xF0, 0x01, 0x50, 0x14, 0x02, 0x2F, 0x10, 0x00, 0x02, 0x08, 0x00, 0xC8, 0x00, 0x16, 0x00, 0x00, 0xc8, 0x41, 0x06, 0x00, 0xA0, 0x0F, 0x12, 0xFF, 0x00, 0x03, 0x45, 0xE6, 0x04 ];
let onlineCmdResponse_5ValOk = [ 0x01, 0x10, 0x01, 0xF0, 0x09, 0x70, 0x31, 0x02, 0x2F, 0x10, 0x00, 0x05, 0x08, 0x00, 0xC8, 0x00, 0x16, 0xAB, 0xF8, 0x29, 0x42, 0x0C, 0x00, 0x58, 0x02, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x5C, 0x12, 0x14, 0xD3, 0x00, 0x00, 0x00, 0x06, 0x00, 0x20, 0x57, 0x12, 0x0F, 0x05, 0x06, 0x00, 0x24, 0x5E, 0x12, 0x00, 0x00, 0x03, 0xF4, 0x24, 0x04 ];

/**
 * This function will comprate two MeasChannel objects
 * @param {MeasChannel} val1 measurement channel value 1
 * @param {MeasChannel} val2 measurement channel value2 
 */
function chValIdentical(val1, val2) {
    if( (val1 instanceof mod_umbparser.MeasChVal) &&
        (val2 instanceof mod_umbparser.MeasChVal) )
    {
        if( (val1.ch_number == val2.ch_number) &&
            (val1.ch_status == val2.ch_status) &&
            (val1.ch_data_type == val2.ch_data_type) &&
            (val1.ch_value.toPrecision(3) == val2.ch_value.toPrecision(3)) )
        {
            return true;
        }
    }

    return false;
}

/**
 * Status frame test
 */
describe('#status frame', function(){
    it('Parsing UMB status request with error status OK', function() {
        umbstatus = umbparser.ParseReadBuf(statusOkResponse);
        assert.equal(umbstatus.umbframe.cmd, 0x26);
        assert.equal(umbstatus.umbframe.status, 0x00);
        assert.equal(umbstatus.umbframe.type, "response");
        assert.equal(umbstatus.parserState, "finished");
    })
    it('Parsing UMB status request with error status E55', function() {
        umbstatus = umbparser.ParseReadBuf(status55Response);
        assert.equal(umbstatus.umbframe.status, 0x55);
        assert.equal(umbstatus.umbframe.type, "response");
        assert.equal(umbstatus.parserState, "finished");
    })
});

/**
 * Multi channel request test
 */
describe('#online command', function(){
    it('Online command data with 2 ok values', function() {
        umbresponse = umbparser.ParseReadBuf(onlineCmdResponse_2ValOk);
        assert.equal(umbresponse.umbframe.cmd, 0x2F);
        assert.equal(umbresponse.umbframe.status, 0x00);
        assert.equal(umbresponse.umbframe.type, "response");
        assert.equal(umbresponse.parserState, "finished");
    })
    it('Online command data with 6 ok values', function() {
        
        expChValues = new Array();
        expChValues[0] = new mod_umbparser.MeasChVal();
        expChValues[0].ch_number = 200;
        expChValues[0].ch_value = 1.1043091083500628e-13;
        expChValues[0].ch_data_type = "FLOAT";
        expChValues[0].ch_status = 0;
        expChValues[1] = new mod_umbparser.MeasChVal();
        expChValues[1].ch_number = 600;
        expChValues[1].ch_value = 1.14e-322;
        expChValues[1].ch_data_type = "DOUBLE";
        expChValues[1].ch_status = 0;
        expChValues[2] = new mod_umbparser.MeasChVal();
        expChValues[2].ch_number = 4700;
        expChValues[2].ch_value = 54036;
        expChValues[2].ch_data_type = "ULONG";
        expChValues[2].ch_status = 0;
        expChValues[3] = new mod_umbparser.MeasChVal();
        expChValues[3].ch_number = 22304;
        expChValues[3].ch_value = 3858;
        expChValues[3].ch_data_type = "USHORT";
        expChValues[3].ch_status = 0;
        expChValues[4] = new mod_umbparser.MeasChVal();
        expChValues[4].ch_number = 24100;
        expChValues[4].ch_value = 18;
        expChValues[4].ch_data_type = "USHORT";
        expChValues[4].ch_status = 0;

        umbresponse = umbparser.ParseReadBuf(onlineCmdResponse_5ValOk);
        assert.equal(umbresponse.parserState, "finished", "Parser state isn't finished");
        assert.equal(umbresponse.umbframe.type, "response", "No response frame detected");
        assert.equal(umbresponse.umbframe.status, 0x00, "Status !0 OK");
        assert.equal(umbresponse.umbframe.cmd, 0x2F, "wrong command detected");
        assert.equal(Array.isArray(umbresponse.umbframe.parsedData), true, "return value isn't an array");
        umbresponse.umbframe.parsedData.forEach(parsedCh => {
            let found = expChValues.find(curChVal => {
                if(chValIdentical(parsedCh, curChVal)) {
                    //console.log("channel " + parsedCh.ch_number + " found");
                    return true;
                }
                return false;
            });

            assert.notEqual(found, undefined, "Channel parsing error");
        });
    })
});
