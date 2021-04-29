/**
 * Copyright (c) 2020 OTT Hydromet Fellbach GmbH
 *
 * UMB constants
 *
 * @summary UMB constants
 * @author Martin Kiepfer <martin.kiepfer@otthydromet.com>
 */

/**
 * UMB frame character position (index)
 * 
 * UMB frame layout
 *
 *  0  |   1     |  2-3   | 4-5      | 6       | 7   |   8     |   9      | 10 - (7+len) | 8+len | (9+len) - (10+len) | 11+len
 * --- | ------- | ------ | -------- | ------- | --- | ------- | -------- | ------------ | ----- | ------------------ | ------
 * SOH | \<ver\> | \<to\> | \<from\> | \<len\> | STX | \<cmd\> | \<verc\> | \<payload\>  | ETX   | \<cs\>             | EOT
 */
const UMBFRAME_IDX = {
    SOH              :  0,    //!< Index of SOH in UMB frame buf
    VER              :  1,    //!< Frame index of frame version identifier
    FROM_ADDR        :  4,    //!< Frame index of destination address
    TO_ADDR          :  2,    //!< Frame index of destination address
    STX              :  7,    //!< Frame index for StartOfTXData identifier
    LEN              :  6,    //!< Frame length field frame index
    CMD              :  8,    //!< Command field frame index
    CMDV             :  9,    //!< Command version field frame index
    SUBCMD           :  10,   //!< SubCommand field frame index
    RES_STATUS       :  10,   //!< The first byte of payload data defines the status of a response
    RES_SUBCMD       :  11,   //!< SubCommand field frame index
    REQ_SUBCMD       :  10,   //!< SubCommand field frame index
}

/**
 * UMB frame special field values
 */
const UMBFRAME_VAL = {
    SOH              :  0x01, //!< Start of Header
    STX              :  0x02, //!< StartOfTXData identifier value
    ETX              :  0x03, //!< End of TXData
    EOT              :  0x04, //!< End of transmission
}

/**
 * Other UMB constants
 */
const UMBFRAME_VERSION_V10              = 0x10;
const UMBFRAME_CONTROLLER_ADDR          = 0xF001;
const UMBFRAME_MAX_FRAMELENGTH          = 255;
const UMBFRAME_FRAME_LENGTH_OVERHEAD    = 12;
const UMBFRAME_MAX_PAYLOAD_LENGTH       = (UMBFRAME_MAX_FRAMELENGTH - UMBFRAME_FRAME_LENGTH_OVERHEAD - 2 - 2);
const UMBFRAME_MAX_LENGTH               = (UMBFRAME_MAX_FRAMELENGTH - UMBFRAME_FRAME_LENGTH_OVERHEAD - 2);

/**
 * UMB command values
 */
const UMB_CMD = {
    GET_HWSW_VERSION : 0x20,
    E2_WRITE : 0x22,
    E2_READ : 0x21,
    RESET : 0x25,
    GETCHANNEL : 0x23,
    STATUS : 0x26,
    TIME_SET : 0x27,
    TIME_GET : 0x28,
    SET_PROTOCOL : 0x2B,
    GET_LASTSTATUS : 0x2C,
    GETDEVINFO : 0x2D,
    RESET_DELAY : 0x2E,
    GETMULTICHANNEL : 0x2F,
    SET_NEW_DEVICE_ID : 0x30,

    TUNNEL : 0x36,
    FWUPDATE : 0x37,
    BINDATA : 0x38,
}

/**
 * UMB Error status
 */ 
const ERROR_STATUS =
{
    STATUS_OK : 0x00,                   //!< 0x00, Command successful
    STATUS_UNKNOWN_CMD : 0x10,          //!< 0x10, Unknown command
    STATUS_INVALID_PARAM : 0x11,        //!< 0x11, Invalid parameter
    STATUS_INVALID_HEADER : 0x12,       //!< 0x12, Invalid header version
    STATUS_INVALID_VERC : 0x13,         //!< 0x13, Invalid command version
    STATUS_INVALID_PW : 0x14,           //!< 0x14, Password mismatch
    STATUS_INVALID_VALUE : 0x15,        //!< 0x15, Invalid value

    STATUS_READ_ERR : 0x20,             //!< 0x20, Read error
    STATUS_WRITE_ERR : 0x21,            //!< 0x21, Write error
    STATUS_TOO_LONG : 0x22,             //!< 0x22, Too long
    STATUS_INVALID_ADDRESS : 0x23,      //!< 0x23, Invalid address
    STATUS_INVALID_CHANNEL : 0x24,      //!< 0x24, Invalid channel
    STATUS_INVALID_CMD : 0x25,          //!< 0x25, Command impossible in mode
    STATUS_UNKNOWN_CAL_CMD : 0x26,      //!< 0x26, Unknown adjustment command
    STATUS_CAL_ERROR : 0x27,            //!< 0x27, Adjustment error
    STATUS_BUSY : 0x28,                 //!< 0x28, Busy
    STATUS_LOW_VOLTAGE : 0x29,          //!< 0x29, Low voltage
    STATUS_HW_ERROR : 0x2A,             //!< 0x2A, Hardware fault
    STATUS_MEAS_ERROR : 0x2B,           //!< 0x2B, Measurement error
    STATUS_INIT_ERROR : 0x2C,           //!< 0x2C, Error during initialization
    STATUS_OS_ERROR : 0x2D,             //!< 0x2D, Operating system error
    STATUS_COM_ERROR : 0x2E,            //!< 0x2E, internal Communication Error
    STATUS_HW_SW_MISMATCH : 0x2F,       //!< 0x2F, Hardware and software version does not match
    STATUS_E2_DEFAULT_KONF : 0x30,      //!< 0x30, Error, default E2 loaded
    STATUS_E2_CAL_ERROR : 0x31,         //!< 0x31, Adjustment invalid
    STATUS_E2_CRC_CONF_ERR : 0x32,      //!< 0x32, Config data CRC error
    STATUS_E2_CRC_CAL_ERR : 0x33,       //!< 0x33, Adjustment data CRC error
    STATUS_ADJ_STEP1 : 0x34,            //!< 0x34, Adjustment step 1
    STATUS_ADJ_OK : 0x35,               //!< 0x35, Adjustment OK
    STATUS_CHANNEL_OFF : 0x36,          //!< 0x36, Channel off
    STATUS_SERVICE_MODE : 0x37,         //!< 0x37, Service mode active
    STATUS_VALUE_OVERFLOW : 0x50,       //!< 0x50, Value over displayable range (+offset)
    STATUS_VALUE_UNDERFLOW : 0x51,      //!< 0x51, Value under displayable range(+offset)
    STATUS_CHANNEL_OVERRANGE : 0x52,    //!< 0x52, Physical value over range
    STATUS_CHANNEL_UNDERRANGE : 0x53,   //!< 0x53, Physical value under range
    STATUS_DATA_ERROR : 0x54,           //!< 0x54, Measurement data invalid
    STATUS_MEAS_UNABLE : 0x55,          //!< 0x55, Measurement impossible
    STATUS_CALC_ERROR : 0x56,           //!< 0x56, Calculation error (Nan, devision by zero)
    STATUS_FLASH_CRC_ERR : 0x60,        //!< 0x60, Flash data CRC error
    STATUS_FLASH_WRITE_ERR : 0x61,      //!< 0x61, Error writing flash
    STATUS_FLASH_FLOAT_ERR : 0x62,      //!< 0x62, Invalid float value
    STATUS_FLASH_ERR : 0x63,            //!< 0x63, Flash defective
    STATUS_CONFIG_ERR : 0x64,           //!< 0x64, Configuration error

    /* L2P extension */
    //FW_RECEIVE_ERR      = 0x80,           //!< Firmware upgrade not possible
    //CRC_ERR             = 0x91,           //!< CRC error
    //TIMEOUT_ERR         = 0x82,           //!< Timeout error
    /* F0h - FEh */                         //!< Reserved LCOM

    STATUS_UNKNOWN_ERR : 0xFF           //!< Unspecified error
}

/**
 * UMB timeout
 */
const UMB_TIMEOUT = {
    TIMEOUT_LONG : 510,
    TIMEOUT : 60
}

/**
 * UMB command version
 */
const UMB_CMDVER = {
    V10 : 0x10,
    V11 : 0x11,
} 

/**
 * UMB Subcommand values
 */
const UMB_SUMBCMD = {
    NONE : 0,
    FWUPDATE_INIT : 0x01,
    FWUPDATE_GET_STATUS : 0x02,
    FWUPDATE_TX : 0x10,
    BINDATA_BLOCKLEN : 0x10,
    BINDATA_OBJINFO : 0x11,
    BINDATA_OBJLOCK : 0x12,
    BINDATA_OBJUNLOCK : 0x13,
    BINDATA_OBJCRC : 0x14,
    BINDATA_OBJRX : 0x20,
    BINDATA_OBJTX : 0x30,
    GETDEVINFO_DEVNAME : 0x10,
    GETDEVINFO_DESCRIPTION : 0x11,
    GETDEVINFO_HWSW_VERSION : 0x12,
    GETDEVINFO_EXTINFO : 0x13,
    GETDEVINFO_EESIZE : 0x14,
    GETDEVINFO_GET_CH_NUM : 0x15,
    GETDEVINFO_GET_CH : 0x16,
    GETDEVINFO_EXT_VER_NUM : 0x17,
    GETDEVINFO_EXT_VER_INFO : 0x18,
    GETDEVINFO_GET_CH_NAME : 0x20,
    GETDEVINFO_GET_CH_RANGE : 0x21,
    GETDEVINFO_GET_CH_UNIT : 0x22,
    GETDEVINFO_GET_CH_DATATYPE : 0x23,
    GETDEVINFO_GET_CH_TYPE : 0x24,
    GETDEVINFO_GET_CH_INFO : 0x30,
    GETDEVINFO_GET_IP_NUM : 0x40,
    GETDEVINFO_GET_IP_INFO : 0x41,
}


module.exports.umb_consts = {
    UMBFRAME_VAL,
    UMBFRAME_IDX,
    UMBFRAME_VERSION_V10,
    UMBFRAME_MAX_FRAMELENGTH,
    UMBFRAME_MAX_PAYLOAD_LENGTH,
    UMBFRAME_MAX_LENGTH,
    UMBFRAME_FRAME_LENGTH_OVERHEAD,
    UMBFRAME_CONTROLLER_ADDR,
    UMB_CMD,
    UMB_CMDVER,
    UMB_SUMBCMD,
    UMB_TIMEOUT,
    ERROR_STATUS
}
