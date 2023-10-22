pragma solidity 0.5.17;

import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/IERC20_.sol";

import "./IAirSwapFeeConnector.sol";
import "./IFeeLogic.sol";
import "./IFeeVault.sol";
import "./ISwapERC20.sol";

contract AirSwapFeeConnector is Ownable, IAirSwapFeeConnector {
    using SafeMath for uint256;

    address public feeLogicAddress;
    address public feeVaultAddress;
    address public swapERC20Address;

    event FeeLogicAddressChangedEvent(address indexed sender, address newAddress);
    event FeeVaultAddressChangedEvent(address indexed sender, address newAddress);
    event SwapERC20AddressChangedEvent(address indexed sender, address newAddress);

    event SwapEvent(
        address indexed sender,
        address indexed recipient,
        address sendToken,
        uint256 sendAmount,
        uint256 inputFee,
        address receiveToken,
        uint256 receiveAmount,
        uint256 outputFee
    );

    /*** setters  ***/

    function setFeeVaultAddress(address _newAddress) public onlyOwner {
        feeVaultAddress = _newAddress;
        emit FeeVaultAddressChangedEvent(msg.sender, feeVaultAddress);
    }

    function setFeeLogicAddress(address _newAddress) public onlyOwner {
        feeLogicAddress = _newAddress;
        emit FeeLogicAddressChangedEvent(msg.sender, feeLogicAddress);
    }

    function setSwapERC20Address(address _newAddress) public onlyOwner {
        swapERC20Address = _newAddress;
        emit SwapERC20AddressChangedEvent(msg.sender, swapERC20Address);
    }

    function swap(
        address _senderToken,
        uint256 _totalSenderAmount,
        address _signerWallet,
        address _signerToken,
        uint256 _signerAmount,
        address _recipient,
        uint256 _nonce,
        uint256 _expiry,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) public {
        address sender = msg.sender;

        // first we move all the funds here

        require(
            IERC20_(_senderToken).transferFrom(sender, address(this), _totalSenderAmount),
            "transfer failed"
        );

        // then we collect the input fee
        uint256 inputFee = IFeeLogic(feeLogicAddress).calculateInputFee(_totalSenderAmount);
        require(
            IERC20_(_senderToken).transferFrom(address(this), feeVaultAddress, inputFee),
            "transfer failed"
        );

        uint256 senderAmountAfterFee = _totalSenderAmount.sub(inputFee);

        // now we do the swap
        ISwapERC20(swapERC20Address).swap(
            address(this),
            _nonce,
            _expiry,
            _signerWallet,
            _signerToken,
            _signerAmount,
            _senderToken,
            senderAmountAfterFee,
            _v,
            _r,
            _s
        );

        // now we collect the output fee
        uint256 outputFee = IFeeLogic(feeLogicAddress).calculateOutputFee(_signerAmount);
        require(
            IERC20_(_signerToken).transferFrom(address(this), feeVaultAddress, outputFee),
            "transfer failed"
        );

        uint256 receiveAmountAfterFee = _signerAmount.sub(outputFee);

        // now we send the user her due
        require(
            IERC20_(_signerToken).transferFrom(address(this), _recipient, receiveAmountAfterFee),
            "transfer failed"
        );

        emit SwapEvent(
            sender,
            _recipient,
            _senderToken,
            _totalSenderAmount,
            inputFee,
            _signerToken,
            _signerAmount,
            outputFee
        );
    }
}
