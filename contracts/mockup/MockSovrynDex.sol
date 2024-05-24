pragma solidity 0.5.17;

import "../interfaces/IERC20.sol";

contract MockSovrynDex {
    mapping(address => uint256) public tokenFees;
    uint16 public constant SOVRYN_DEX_COLD_PATH_PROXY_IDX = 3;
    uint8 public constant SOVRYN_DEX_CMD_COLLECT_TREASURY_CODE = 40;
    IERC20 wrbtcToken;
    address treasury;

    constructor() public {}

    function setTreasury(address _treasury) public {
        treasury = _treasury;
    }

    function setWrbtcToken(IERC20 _wrbtcToken) public {
        wrbtcToken = _wrbtcToken;
    }

    function userCmd(uint16 callpath, bytes calldata cmd) external payable returns (bytes memory) {
        require(msg.sender == treasury, "Only Treasury");
        (uint8 cmdCode, address token) = abi.decode(cmd, (uint8, address));
        if (
            callpath == SOVRYN_DEX_COLD_PATH_PROXY_IDX &&
            cmdCode == SOVRYN_DEX_CMD_COLLECT_TREASURY_CODE
        ) {
            wrbtcToken.transfer(msg.sender, tokenFees[token]);
            return abi.encode(tokenFees[token]);
        } else {
            return "0x";
        }
    }

    function setTokenDexFee(address token, uint256 fee) external {
        tokenFees[token] = fee;
    }
}
