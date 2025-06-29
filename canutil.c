class
    unsigned long
    char2long(unsigned char *str)
{
    unsigned long num = 0;
    memcpy((unsigned char *)(&num), str, 4);
    return num;
}

void long2char(unsigned long num, unsigned char *str)
{
    memcpy(str, (unsigned char *)(&num), 4);
}

unsigned int CrcCalculate(unsigned char Byte, unsigned int _CRC)
{
    unsigned char Carry;
    int Bit_Index;
    _CRC = _CRC ^ (Byte & 0xFF);
    for (Bit_Index = 0; Bit_Index < 8; Bit_Index++)
    {
        Carry = _CRC & 0x0001;
        _CRC = _CRC >> 1;
        if (Carry)
            _CRC = _CRC ^ 0xA001;
    }
    return _CRC;
}

unsigned int calCRC(unsigned char *str)
{
    unsigned int __crc = 0xffff;
    int i = 0;

    for (i = 0; i < str[1]; i++)
    {
        __crc = CrcCalculate(str[i + 2], __crc);
    }
    return __crc;
}

unsigned char checkCRC(unsigned char *str)
{
    unsigned int __crc = calCRC(str);
    unsigned int __crc0 = str[3 + str[1]];

    __crc0 <<= 8;
    __crc0 |= str[2 + str[1]];

    return (__crc == __crc0);
    return 0;
}
