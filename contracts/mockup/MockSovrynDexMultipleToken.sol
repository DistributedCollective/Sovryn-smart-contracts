pragma solidity 0.5.17;

import "../interfaces/IERC20.sol";
import "../governance/IFeeSharingCollectorMultiToken.sol";

contract MockSovrynDexMultiToken {
    mapping(address => uint96) public tokenFees;
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

    function userCmd(uint16 callpath, bytes calldata cmd) external payable {
        require(msg.sender == treasury, "Only Treasury");
        (uint8 cmdCode, address token) = abi.decode(cmd, (uint8, address));
        if (
            callpath == SOVRYN_DEX_COLD_PATH_PROXY_IDX &&
            cmdCode == SOVRYN_DEX_CMD_COLLECT_TREASURY_CODE
        ) {
            IERC20(token).approve(treasury, tokenFees[token]);
            IFeeSharingCollectorMultiToken(treasury).transferTokens(token, tokenFees[token]);
        }
    }

    function setTokenDexFee(address token, uint96 fee) external {
        tokenFees[token] = fee;
    }
}
