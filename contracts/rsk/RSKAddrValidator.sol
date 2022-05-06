// SPDX-License-Identifier:MIT
pragma solidity ^0.5.17;

library RSKAddrValidator {
    /*
     * @param addr it is an address to check that it does not originates from
     * signing with PK = ZERO. RSK has a small difference in which @ZERO_PK_ADDR is
     * also an address from PK = ZERO. So we check for both of them.
     * */
    function checkPKNotZero(address addr) internal pure returns (bool) {
        return (addr != 0xdcc703c0E500B653Ca82273B7BFAd8045D85a470 && addr != address(0));
    }

    /*
     * Safely compares two addresses, checking they do not originate from
     * a zero private key.
     * */
    function safeEquals(address addr1, address addr2) internal pure returns (bool) {
        return (addr1 == addr2 &&
            addr1 != 0xdcc703c0E500B653Ca82273B7BFAd8045D85a470 &&
            addr1 != address(0));
    }
}
