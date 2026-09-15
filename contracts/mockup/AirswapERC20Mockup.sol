pragma solidity 0.5.17;

import "../openzeppelin/IERC20_.sol";
import "../integrations/airswap/IAirswapSwapERC20.sol";

// This contract is only for testing purposes
contract AirswapERC20Mockup is IAirswapSwapERC20 {
    int16 public swapCalled = 0;

    address public recipient;
    uint256 public nonce;
    uint256 public expiry;
    address public signerWallet;
    address public signerToken;
    uint256 public signerAmount;
    address public senderToken;
    uint256 public senderAmount;
    uint8 public v;
    bytes32 public r;
    bytes32 public s;

    function reset() public {
        recipient = address(0);
        nonce = 0;
        expiry = 0;
        signerWallet = address(0);
        signerToken = address(0);
        signerAmount = 0;
        senderToken = address(0);
        senderAmount = 0;
        v = 0;
        r = 0;
        s = 0;

        swapCalled = 0;
    }

    function swap(
        address _recipient,
        uint256 _nonce,
        uint256 _expiry,
        address _signerWallet,
        address _signerToken,
        uint256 _signerAmount,
        address _senderToken,
        uint256 _senderAmount,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        recipient = _recipient;
        nonce = _nonce;
        expiry = _expiry;
        signerWallet = _signerWallet;
        signerToken = _signerToken;
        signerAmount = _signerAmount;
        senderToken = _senderToken;
        senderAmount = _senderAmount;
        v = _v;
        r = _r;
        s = _s;

        swapCalled++;

        IERC20_(_signerToken).transfer(_recipient, _signerAmount);
    }
}
