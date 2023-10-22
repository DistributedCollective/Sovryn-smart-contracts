pragma solidity 0.5.17;

import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/PausableOz.sol";
import "../openzeppelin/IERC20_.sol";

import "./IAirSwapFeeConnector.sol";
import "./ISwapERC20.sol";

contract AirSwapFeeConnector is PausableOz, IAirSwapFeeConnector {
    using SafeMath for uint256;

    uint256 public constant POINTS = 1000;

    uint256 public inputFeeInPoints = 0;
    uint256 public outputFeeInPoints = 0;

    address public feeVaultAddress = address(0);
    address public swapERC20Address = address(0);

    event FeeVaultAddressChangedEvent(address indexed sender, address newAddress);
    event SwapERC20AddressChangedEvent(address indexed sender, address newAddress);
    event InputFeeChanged(address indexed sender, uint256 feeInPoints);
    event OutputFeeChanged(address indexed sender, uint256 feeInPoints);

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

    /// @notice Set the input fee in points, ie 25 means 2.5 percent.
    ///         The input fee is collected on the sent tokens before 
    ///         the actual conversion.
    /// @param inputFeeInPoints The new fee in points
    function setInputFee(uint256 _inputFeeInPoints) public onlyOwner {
        inputFeeInPoints = _inputFeeInPoints;
        emit InputFeeChanged(msg.sender, inputFeeInPoints);
    }

    /// @notice Set the output fee in points, ie 25 means 2.5 percent.
    ///         The output fee is collected after the conversion.
    /// @param outputFeeInPoints The new fee in points
    function setOutputFee(uint256 _outputFeeInPoints) public onlyOwner {
        outputFeeInPoints = _outputFeeInPoints;
        emit OutputFeeChanged(msg.sender, outputFeeInPoints);
    }

    /// @notice Set the address to which fees are sent
    /// @param _newAddress The new address
    function setFeeVaultAddress(address _newAddress) public onlyOwner {
        feeVaultAddress = _newAddress;
        require(feeVaultAddress != address(0), "invalid vault");
        emit FeeVaultAddressChangedEvent(msg.sender, feeVaultAddress);
    }

    /// @notice Set the address of the AirSwap contract
    /// @param _newAddress The new address
    function setSwapERC20Address(address _newAddress) public onlyOwner {
        swapERC20Address = _newAddress;
        require(swapERC20Address != address(0), "invalid swapper");
        emit SwapERC20AddressChangedEvent(msg.sender, swapERC20Address);
    }

    function calculateInputFee(uint256 _sendAmount) public view returns (uint256) {
        return _sendAmount.mul(inputFeeInPoints).div(POINTS);
    }

    function calculateOutputFee(uint256 _receiveAmount) public view returns (uint256) {
        return _receiveAmount.mul(outputFeeInPoints).div(POINTS);
    }

    /// @notice Swap one token for another.
    /// @param _senderToken The token which is to be sent
    /// @param _totalSenderAmount The amount to be sent before the input fee is collected. 
    /// @param _signerWallet Address of the market maker wallet
    /// @param _signerToken Address of the token to convert to
    /// @param _signerAmount Amount of resulting token from the conversion
    /// @param _recipient Address to send the resulting tokens after collecting the output fee
    /// @param _nonce A one time nonce
    /// @param _expiry Date at which the original proposal will expire
    /// @param _v v part of the ECDSA signature
    /// @param _r r part of the ECDSA signature
    /// @param _s s part of the ECDSA signature
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

        require(feeVaultAddress != address(0), "invalid vault");
        require(swapERC20Address != address(0), "invalid swapper");

        // first we move all the funds here
        require(
            IERC20_(_senderToken).transferFrom(sender, address(this), _totalSenderAmount),
            "transfer failed"
        );

        // then we collect the input fee
        uint256 inputFee = calculateInputFee(_totalSenderAmount);
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
        uint256 outputFee = calculateOutputFee(_signerAmount);
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

        // emit the event
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
