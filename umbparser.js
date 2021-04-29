/**
 * Copyright (c) 2020 OTT Hydromet Fellbach GmbH
 *
 * UMB parser objects
 *
 * @summary UMB parser objects
 * @author Martin Kiepfer <martin.kiepfer@otthydromet.com>
 */
const CRC = require('crc-full').CRC;
const umb_consts = require('./umb_consts').umb_consts;
        
/**
 * Detailed parsing frame state
 */
const FRAME_STATE =
{
    PAR_SOH : 0,
    PAR_VER : 1,
    PAR_LO_LSB : 2,
    PAR_TO_MSB : 3,
    PAR_FROM_LSB : 4,
    PAR_FROM_MSB : 5,
    PAR_LEN : 6,
    PAR_STX : 7,
    PAR_CMD : 8,
    PAR_CMD_VER : 9,
    PAR_PAYLOAD : 10,
    PAR_ETX : 11,
    PAR_CRC_LSB : 12,
    PAR_CRC_MSB : 13,
    PAR_EOT : 14
}

/**
 * General parsing state
 */
const PAR_STATE =
{
    PARSER_IDLE : 'idle',
    PARSER_PROCESSING : 'prcoessing',
    PARSER_ERROR : 'error',
    PARSER_CRCERROR : 'crc_error',
    PARSER_FINISHED : 'finished',
}

/**
 * Frame types
 */
const FRAME_TYPE =
{
    REQUEST: 'request',
    RESPONSE: 'response',
    UNKNOWN: 'unknown'
}

/**
 * Default channel name LUT
 */
const DefaultChannels = new Map(
    [
        [100, "Temperature"],
        [200, "Rel. Humidity"],
        [300, "Air Pressure"],
        [400, "Wind Speed"],
        [405, "Wind Speed"],
        [500, "Wind Direction"],
        [600, "Precipiation amount"],
        [601, "Precipiation amount daily"],
        [700, "Precipiation tpe"],
        [900, "Global Radiation"],
        [903, "Illumination"],
        [904, "Dawn"],
        [910, "Sun Direction Azimut"],
        [911, "Sun Direction Elevation"],
    ]
);

/**
 * UMBFrame base class
 */
class UMBFrame 
{
    /**
     * 
     */
    constructor() 
    {
        this.type = FRAME_TYPE.UNKNOWN;
        this.payload = new Uint8Array();
        this.cmd = 0;
        this.status = -1;
        this.crc = 0xFFFF;
        this.framedata;
    }
}

/**
 * UMB frame data class
 * This oject is the basic object for all information about a parsed UMB frame
 */
class UMBFrameData
{
    /**
     * 
     * @param {string} name Name/Type of the parsed frame
     * @param {object[]} rawdata Detailed raw data of the parse frame (e.g. MeasChVal)
     * @param {object[]} parsedata Processed parsed data to be used for further proceeding (JSON)
     */
    constructor(name, rawdata, parsedata)
    {
        this.name = name
        this.raw = rawdata;
        this.parsed = parsedata;
    }
}

/**
 * Measurement channel object
 */
class MeasChVal
{
    /**
     * MeasChVal constructor
     * @param {int} number Channel number
     * @param {int} value Channe value
     * @param {String} data_type Data type
     * @param {int} status Channel status
     */
    constructor(number, data_type, status, dview) 
    {
        this.ch_number = number;      // Kanalnummer
        this.ch_data_type = MeasChVal.getDataTypeName(data_type);   // Datentype
        this.ch_status = status;      // UMB-Status   
        this.ch_value = NaN;

        switch(data_type)
        {
            case 0x10:
                this.ch_value = dview.getUint8(0);
                break;
            case 0x11:
                this.ch_value = dview.getInt8(0);
                break;
            case 0x12:
                this.ch_value = dview.getUint16(0, true);
                break;
            case 0x13:
                this.ch_value = dview.getInt16(0, true);
                break;
            case 0x14:
                this.ch_value = dview.getUint32(0, true);
                break;
            case 0x15:
                this.ch_value = dview.getInt32(0, true);
                break;
            case 0x16:
                this.ch_value = dview.getFloat32(0, true);
                break;
            case 0x17:
                this.ch_value = dview.getFloat64(0, true);
                break;
        }

    }

    static getDataTypeName(dtype)
    {
        let ch_data_type = "UNKOWN";
        switch(dtype)
        {
            case 0x10:
                ch_data_type = "UCHAR";
                break;
            case 0x11:
                ch_data_type = "SCHAR";
                break;
            case 0x12:
                ch_data_type = "USHORT";
                break;
            case 0x13:
                ch_data_type = "SSHORT";
                break;
            case 0x14:
                ch_data_type = "ULONG";
                break;
            case 0x15:
                ch_data_type = "SLONG";
                break;
            case 0x16:
                ch_data_type = "FLOAT";
                break;
            case 0x17:
                ch_data_type = "DOUBLE";
                break;
        }
        return ch_data_type;
    }               

    static getMeasTypeName(chtype)
    {
        let meas_name = "UNKOWN";
        switch(chtype)
        {
            case 0x10:
                meas_name = "Current";
                break;
            case 0x11:
                meas_name = "Minimum";
                break;
            case 0x12:
                meas_name = "Maximum";
                break;
            case 0x13:
                meas_name = "Average";
                break;
            case 0x14:
                meas_name = "Sum";
                break;
            case 0x15:
                meas_name = "Vector";
                break;
        }
        return meas_name;
    }
}

/**
 * UMB parser object
 */
class UMBParser 
{
    /**
     * Basic constructor
     */
    constructor(node) 
    {
        this.node = node;
        this.readBuffer = new Array();
        this.parsingIdx = 0;
        this.parsingSOHIdx = 0;
        this.parsingETXIdx = 0;
        this.parsingCRC = 0;
        this.payloadCnt = 0;
        this.frameState = FRAME_STATE.PAR_SOH;
        this.parserState = PAR_STATE.PARSER_PROCESSING;
        this.payload = new Uint8Array();
        this.CRC = new CRC("CRC16", 16, 0x1021, 0xFFFF, 0x0000, true, true);

        this.channelmap = new Map(this.node.cfg_channels.channels.map(i => [parseInt(i.ch), i.chname]));
    }

    /**
     * Returns the 8-bit checksum given an array of byte-sized numbers
     * @param {Array} byte_array Byte array to calculate the CRC on
     */
    calcCRC(byte_array) 
    {
        return this.CRC.compute(byte_array);
    } 

    /**
     * This function resets the internal parserr state
     */
    resetParser(empty = false) 
    {
        if(empty) 
        {
            this.readBuffer = new Array();
        }
        else
        {
            this.readBuffer = this.readBuffer.slice(this.parsingSOHIdx);
        }
        this.parsingSOHIdx = 0;
        this.parsingIdx = 0;
        this.payloadCnt = 0;
        this.parsingETXIdx = 0;
        this.payload = new Uint8Array();
        this.frameState = FRAME_STATE.PAR_SOH;
    }

    /**
     * Parsing function.
     * This function parses a binary stream for UMB data. The passed buffer 
     * don't need to include the complate UMB frame and this function can 
     * be called subsequently.
     * @param {ArrayBuffer} curBuffer Current binary data
     */
    ParseReadBuf(curBuffer)
    {
        // return immediately if readLen == 0, handleTransfer now calls the parser also when no characters received (Modbus RTU)
        if ((typeof curBuffer == ArrayBuffer) && (curBuffer.length == 0))
        {
            return;
        }

        // Push curent data
        this.readBuffer = curBuffer;

        this.parsingIdx = 0;
        while(this.parsingIdx < this.readBuffer.length)
        {
            switch(this.frameState)
            {
            case FRAME_STATE.PAR_SOH:
                if(this.readBuffer[this.parsingIdx] == umb_consts.UMBFRAME_VAL.SOH)
                {
                    this.parserState = PAR_STATE.PARSER_PROCESSING;
                    this.frameState = FRAME_STATE.PAR_VER;
                    this.parsingSOHIdx = this.parsingIdx;
                }
                else
                {
                    this.parserState = PAR_STATE.PARSER_ERROR;
                }
                break;
    
            case FRAME_STATE.PAR_VER:
                //@note: This parser currently only supports UMB-V1.0
                if(this.readBuffer[this.parsingIdx] == umb_consts.UMBFRAME_VERSION_V10)
                {
                    this.frameState = FRAME_STATE.PAR_LO_LSB;
                }
                else
                {
                    this.parserState = PAR_STATE.PARSER_ERROR;
                }
                break;
    
            case FRAME_STATE.PAR_LO_LSB:
                this.frameState = FRAME_STATE.PAR_TO_MSB;
                break;
            case FRAME_STATE.PAR_TO_MSB:
                this.frameState = FRAME_STATE.PAR_FROM_LSB;
                break;
            case FRAME_STATE.PAR_FROM_LSB:
                this.frameState = FRAME_STATE.PAR_FROM_MSB;
                break;
            case FRAME_STATE.PAR_FROM_MSB:
                this.frameState = FRAME_STATE.PAR_LEN;
                break;
    
            case FRAME_STATE.PAR_LEN:
                this.frameLength = this.readBuffer[this.parsingIdx];
                if( (this.frameLength < umb_consts.UMBFRAME_MAX_LENGTH) &&
                    (this.frameLength > 2) )
                {
                    this.payloadCnt = 0;
                    this.payload = new Uint8Array(this.frameLength - 2);
                    this.frameState = FRAME_STATE.PAR_STX;
                }
                else
                {
                    this.frameState = FRAME_STATE.PARSER_ERROR;
                }
                break;
    
            case FRAME_STATE.PAR_STX:
                if(this.readBuffer[this.parsingIdx] == umb_consts.UMBFRAME_VAL.STX)
                {
                    this.frameState = FRAME_STATE.PAR_CMD;
                }
                else
                {
                    this.frameState = FRAME_STATE.PARSER_ERROR;
                }
                break;
    
            case FRAME_STATE.PAR_CMD:
                this.frameState = FRAME_STATE.PAR_CMD_VER;
                break;
            case FRAME_STATE.PAR_CMD_VER:
                this.frameState = FRAME_STATE.PAR_PAYLOAD;
                break;
    
            case FRAME_STATE.PAR_PAYLOAD:
                this.payloadCnt++;

                /* <CMD><VERC> are also included in <LEN>-field */
                if(this.payloadCnt <= (this.frameLength - 2))
                {
                    /* Payload data */
                    this.payload.set([this.readBuffer[this.parsingIdx]], this.payloadCnt-1);
                    break;
                }
                else
                {
                    this.frameState = FRAME_STATE.PAR_ETX;
                    /* @note: Fall-Through!! */
                }
                /* no break */
    
            case FRAME_STATE.PAR_ETX:
                if(this.readBuffer[this.parsingIdx] == umb_consts.UMBFRAME_VAL.ETX)
                {
                    this.parsingETXIdx = this.parsingIdx;
                    this.frameState = FRAME_STATE.PAR_CRC_LSB;
                }
                else
                {
                    this.parserState = PAR_STATE.PARSER_ERROR;
                }
                break;
    
            case FRAME_STATE.PAR_CRC_LSB:
                this.frameState = FRAME_STATE.PAR_CRC_MSB;
                this.parsingCRC = this.readBuffer[this.parsingIdx];
                break;
            case FRAME_STATE.PAR_CRC_MSB:
                this.parsingCRC |= (this.readBuffer[this.parsingIdx] << 8);

                let crc = this.calcCRC(this.readBuffer.slice(0, this.parsingETXIdx+1));

                if(crc == this.parsingCRC)
                {
                    this.frameState = FRAME_STATE.PAR_EOT;
                }
                else
                {
                    this.parserState = PAR_STATE.PARSER_CRCERROR;
                }
                break;
            case FRAME_STATE.PAR_EOT:
                if(this.readBuffer[this.parsingIdx] == umb_consts.UMBFRAME_VAL.EOT)
                {
                    /**
                     * At this state it looks like have a valid UMB Frame
                     */
                    this.frameLength = 0;

                    this.parserState = PAR_STATE.PARSER_FINISHED;
                }
                else
                {
                    this.parserState = PAR_STATE.PARSER_ERROR;
                }
                break;
    
            default:
                this.parserState = PAR_STATE.PARSER_ERROR;
                break;
            } // switch END

            this.parsingIdx++;

            /* Check parsing state */
            if((this.parserState == PAR_STATE.PARSER_ERROR) || (this.parserState == PAR_STATE.PARSER_CRCERROR))
            {
                /* start parsing at last SOH */
                this.resetParser();
                break;
            }
        }

        // Finish parsing frame
        let parsedFrame = new UMBFrame();
        if(this.parserState == PAR_STATE.PARSER_FINISHED)
        {
            parsedFrame.FromAddr = (this.readBuffer[umb_consts.UMBFRAME_IDX.FROM_ADDR+1] << 8) | this.readBuffer[umb_consts.UMBFRAME_IDX.FROM_ADDR];
            parsedFrame.ToAddr = (this.readBuffer[umb_consts.UMBFRAME_IDX.TO_ADDR+1] << 8) | this.readBuffer[umb_consts.UMBFRAME_IDX.TO_ADDR];
            parsedFrame.cmd = this.readBuffer[umb_consts.UMBFRAME_IDX.CMD];
            parsedFrame.payload = Object.assign({}, this.payload);;
            parsedFrame.crc = this.calcCRC(this.readBuffer.slice(0, this.parsingETXIdx));
            if(((parsedFrame.FromAddr & 0xF000) == 0xF000) && ((parsedFrame.ToAddr & 0xF000) != 0xF000))
            {
                parsedFrame.type = FRAME_TYPE.REQUEST;
            }
            else if(((parsedFrame.FromAddr & 0xF000) != 0xF000) && ((parsedFrame.ToAddr & 0xF000) == 0xF000))
            {
                parsedFrame.type = FRAME_TYPE.RESPONSE;
                parsedFrame.status = this.payload[0];
            }
            else
            {
                parsedFrame.type = FRAME_TYPE.UNKNOWN;
            }

            // Analyse command
            if((parsedFrame.type == FRAME_TYPE.RESPONSE) && (parsedFrame.status == umb_consts.ERROR_STATUS.STATUS_OK))
            {
                switch(parsedFrame.cmd)
                {
                    case umb_consts.UMB_CMD.GETMULTICHANNEL:
                        parsedFrame.framedata = this.cmdRespChData();
                        break;
                    case umb_consts.UMB_CMD.GETDEVINFO:
                        parsedFrame.framedata = this.cmdRespDevinfo();
                        break;
                }
            }

            this.resetParser(true);
        }
        
        let retval = {
            parserState: this.parserState,
            umbframe: parsedFrame
        }

        return retval;
    }
    
    /**
     * Interal function to analyse channel query response data in more detail
     * It does not need any paramter and uses the last internally 
     * parse frame data.
     * This function will return a UMBFrameData() object with
     * detailed information about the parsed frame
     */
    cmdRespChData()
    {
        let numChannels = this.payload[1];
        let index = 2;
        let chData = new Array();

        for(let i=0; i<numChannels; i++)
        {
            let curDataLen = this.payload[index];
            let curDataView = new DataView(this.payload.buffer, index+1, curDataLen);
            let ch_status = curDataView.getUint8(0);

            if(ch_status == umb_consts.ERROR_STATUS.STATUS_OK)
            {
                let ch_number = curDataView.getUint16(1, true);
                let ch_data_type = curDataView.getUint8(3);

                let curMeasChVal = new MeasChVal(ch_number, ch_data_type, ch_status, new DataView(this.payload.buffer, index+5))
            
                chData.push(curMeasChVal);
            }
            
            index += curDataLen+1;
        }

        let measValues = new Object();
        chData.forEach(element => {
            let curMeasName = this.channelmap.get(element.ch_number);
            this.node.log(curMeasName);
            if (curMeasName in measValues)
            {
                this.node.error("Multiple measurements of " + curMeasName + " selected! Please make sure to query only one.");
            }
            measValues[curMeasName] = element.ch_value.toPrecision(3);
        });

        let parsedData = new UMBFrameData("Multi channel data", chData, measValues);
        return parsedData;
    }

    /**
     * Interal function to analyse device info sub-commands
     */
    cmdRespDevinfo()
    {
        switch(this.payload[1])
        {
            case 0x15:
                return this.cmdRespDevinfo_ChNum();
                break;
            case 0x16:
                return this.cmdRespDevinfo_ChList();
                break;
            case 0x30:
                return this.cmdRespDevinfo_ChDetails();
                break;
        }

        return undefined;
    }

    /**
     * Interal function to analyse device info sub-command to query
     * number of channels
     */
    cmdRespDevinfo_ChNum()
    {
        let chData = new Array();

        let numChannelsView = new DataView(this.payload.buffer, 2, 2);
        let numChannels = numChannelsView.getUint16(0, true);
        let numBlocks = this.payload[4];

        let devInfoNumCh = new Object();
        devInfoNumCh.numChannels = numChannels;
        devInfoNumCh.numBlocks = numBlocks;

        let parsedData = new UMBFrameData("Number of Channels", devInfoNumCh, devInfoNumCh);
        return parsedData;
    }

    /**
     * Interal function to analyse device info sub-command to query
     * number of channels
     */
    cmdRespDevinfo_ChList()
    {
        let chList = new Array();

        let index = 4;
        let block = this.payload[2];
        let numChannels = this.payload[3];

        for(let i=0; i<numChannels; i++)
        {
            let curhannelView = new DataView(this.payload.buffer, index, 2);
            let curChannel = curhannelView.getUint16(0, true);

            index += 2;
            
            chList.push(curChannel);
        }

        let  chListData = new Object();
        chListData.block = block;
        chListData.channels = chList;

        let parsedData = new UMBFrameData("Channel list", chListData, chListData);
        return parsedData;
    }

     /**
     * Interal function to analyse device info sub-command to query
     * number of channels
     */
    cmdRespDevinfo_ChDetails()
    {
        let chDetailsRaw = new Object();

        let byteIdx = 0;
        const payloadOffset = 2;

        // <channel>2 <messgröße>20, <einheit>15, <mw_typ>, <date_typ>, <min>, <max>
        let chDetailsDV1 = new DataView(this.payload.buffer, payloadOffset, 2+20+15+1+1);
        chDetailsRaw.channel = chDetailsDV1.getUint16(byteIdx, true); 
        byteIdx += 2;
        chDetailsRaw.name = new TextDecoder("ISO-8859-1").decode(this.payload.slice(byteIdx+payloadOffset, byteIdx+payloadOffset+20)).trimEnd();
        byteIdx += 20;
        chDetailsRaw.unit = new TextDecoder("ISO-8859-1").decode(this.payload.slice(byteIdx+payloadOffset, byteIdx+payloadOffset+15)).trimEnd();
        byteIdx += 15;
        chDetailsRaw.ch_type = chDetailsDV1.getUint8(byteIdx, true);
        byteIdx++;
        chDetailsRaw.data_type = chDetailsDV1.getUint8(byteIdx, true);
        byteIdx++;

        let chDetails = Object.assign({}, chDetailsRaw);
        chDetails.ch_type = MeasChVal.getMeasTypeName(chDetailsRaw.ch_type);
        chDetails.data_type = MeasChVal.getDataTypeName(chDetailsRaw.data_type);

        let parsedData = new UMBFrameData("Channel Details", chDetailsRaw, chDetails);
        return parsedData;
    }

}

/**
 * UMB Frame generator object
 */
class UMBGenerator 
{

    /**
     * UMBGenerator constructor
     */
    constructor(node) 
    {
        this.node = node;
        this.readBuffer = [];       
        this.CRC = new CRC("CRC16", 16, 0x1021, 0xFFFF, 0x0000, true, true);
    }

    /**
     * Fill bais frame data
     * @param {int} cmd UMB command
     * @param {int} cmd_ver UMB version
     * @param {int} to_addr 2byte UMB address of the destiation device
     * @param {int} from_addr 2byte ZUMB address of the source device
     */
    createReq(cmd, cmd_ver, to_addr, from_addr) 
    {
        this.readBuffer[umb_consts.UMBFRAME_IDX.SOH] = umb_consts.UMBFRAME_VAL.SOH;
        this.readBuffer[umb_consts.UMBFRAME_IDX.VER] = umb_consts.UMBFRAME_VERSION_V10;
        this.readBuffer[umb_consts.UMBFRAME_IDX.STX] = umb_consts.UMBFRAME_VAL.STX;
        this.readBuffer[umb_consts.UMBFRAME_IDX.LEN] = 2;
        this.readBuffer[umb_consts.UMBFRAME_IDX.TO_ADDR] = to_addr & 0xFF;
        this.readBuffer[umb_consts.UMBFRAME_IDX.TO_ADDR+1] = (to_addr & 0xFF00) >> 8;
        this.readBuffer[umb_consts.UMBFRAME_IDX.FROM_ADDR] = from_addr & 0xFF;
        this.readBuffer[umb_consts.UMBFRAME_IDX.FROM_ADDR+1] = (from_addr & 0xFF00) >>8;
        this.readBuffer[umb_consts.UMBFRAME_IDX.CMD] = cmd;
        this.readBuffer[umb_consts.UMBFRAME_IDX.CMDV] = cmd_ver;
    }

    /**
     * Returns the 8-bit checksum given an array of byte-sized numbers
     * @param {Array} byte_array Binary array to calculate the CRC from
     */
    calcCRC(byte_array) 
    {
        return this.CRC.compute(byte_array);
    } 

    /**
     * This method will add the CRC and finalze an UMB frame 
     * based on the passed payload
     * @param {int} payloadLength Length of the payload
     */
    genFrameCRCEnd(payloadLength)
    {
        let crc = 0xFFFF;
        let newFrameLength;

        this.readBuffer[umb_consts.UMBFRAME_IDX.LEN] = payloadLength + 2;
        newFrameLength = umb_consts.UMBFRAME_FRAME_LENGTH_OVERHEAD + this.readBuffer[umb_consts.UMBFRAME_IDX.LEN];

        this.readBuffer[newFrameLength - 4] = umb_consts.UMBFRAME_VAL.ETX;

        crc = this.calcCRC(this.readBuffer.slice(0, newFrameLength - 3))
        this.readBuffer[newFrameLength - 2] = (crc >> 8) & 0xFF;
        this.readBuffer[newFrameLength - 3] = crc & 0xFF;

        this.readBuffer[newFrameLength - 1] = umb_consts.UMBFRAME_VAL.EOT;
    }

    /**
     * Internal method to retrive the payload index according to the given frame type
     * @param {FRAME_TYPE} frame_type Response or Request
     */
    getPayloadDataIndex(frame_type)
    {
        let uDataIdx = (umb_consts.UMBFRAME_IDX.CMDV + 1);
    
        switch (frame_type)
        {
        case FRAME_TYPE.RESPONSE:
            //@TODO
            //if (UmbDispatcher_HasSubCmd(UMBFrame_getCmd(pFrame), UMBFrame_getCmdVer(pFrame)))
            if(0)
            {
                uDataIdx = (umb_consts.UMBFRAME_IDX.SUBCMD + 1);
            }
            else
            {
                uDataIdx = (umb_consts.UMBFRAME_IDX.RES_STATUS + 1);
            }
            break;
    
        case FRAME_TYPE.REQUEST:
            //@TODO
            //if (UmbDispatcher_HasSubCmd(UMBFrame_getCmd(pFrame), UMBFrame_getCmdVer(pFrame)))
            if(0)
            {
                uDataIdx = (umb_consts.UMBFRAME_IDX.SUBCMD + 1);
            }
            else
            {
                uDataIdx = (umb_consts.UMBFRAME_IDX.CMDV + 1);
            }
            break;    
        default:
            uDataIdx = (umb_consts.UMBFRAME_IDX.CMDV + 1);
            break;
        }
    
        return uDataIdx;
    }
    
    /**
     * This method generates a mutlichannel UMB request
     * 
     * @param {number} to_addr Desination addess for the gernerated UMB request
     * @param {Array} channellist List of channels to query
     */
    createMultiChReq(to_addr, channellist) 
    {
        this.createReq(umb_consts.UMB_CMD.GETMULTICHANNEL, 0x10, to_addr, umb_consts.UMBFRAME_CONTROLLER_ADDR);
        let payloadIndex = this.getPayloadDataIndex(FRAME_TYPE.REQUEST);
        let payloadLength = 1+channellist.length*2;

        let chbuf = new Uint8Array(payloadLength);
        let chbuf_view = new DataView(chbuf.buffer);

        // [0] - <num channels>
        chbuf_view.setUint8(0, channellist.length);
        
        // [1..n] - <channels>^2
        for(let i=0; i<channellist.length; i++)
        {
            chbuf_view.setUint16(1+i*2, channellist[i], true);
        }

        for(let i=0; i<chbuf.length; i++) 
        {
            this.readBuffer[payloadIndex+i] = chbuf[i];
        }
        
        this.genFrameCRCEnd(payloadLength);

        return Buffer.from(this.readBuffer);
    }

    /**
     * This method generates a device info request
     * 
     * @param {number} to_addr Desination addess for the gernerated UMB request
     * @param {uint8} subcmd subcommand
     * @param {array} parm parameter
     */
    createDevInfoReq(to_addr, subcmd, option=undefined) 
    {
        this.createReq(umb_consts.UMB_CMD.GETDEVINFO, 0x10, to_addr, umb_consts.UMBFRAME_CONTROLLER_ADDR);
        let payloadIndex = this.getPayloadDataIndex(FRAME_TYPE.REQUEST);
        let payloadLength = 0;

        this.readBuffer[payloadIndex++] = subcmd;
        payloadLength++;

        if((option != undefined) && (Array.isArray(option))) {
            option.forEach(element => {
                this.readBuffer[payloadIndex] = element;
                payloadLength++;
                payloadIndex++
            });
        }
        
        this.genFrameCRCEnd(payloadLength);

        return Buffer.from(this.readBuffer);
    }

    createChNumReq(to_addr)
    {
        return this.createDevInfoReq(to_addr, 0x15)
    }

    createChListReq(to_addr, block)
    {
        return this.createDevInfoReq(to_addr, 0x16, [block])
    }

    createChDetailsReq(to_addr, channel)
    {
        return this.createDevInfoReq(to_addr, 0x30, [channel&0xFF, (channel&0xFF00)>>8])
    }
}

module.exports.UMBParser = UMBParser;
module.exports.UMBGenerator = UMBGenerator;
module.exports.MeasChVal = MeasChVal;
