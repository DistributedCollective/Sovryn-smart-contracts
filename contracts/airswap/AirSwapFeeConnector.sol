pragma solidity 0.5.17;

import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/PausableOz.sol";
import "../openzeppelin/IERC20_.sol";

import "./IAirSwapFeeConnector.sol";
import "./ISwapERC20.sol";

contract AirSwapFeeConnector is PausableOz, IAirSwapFeeConnector {
    using SafeMath for uint256;

    struct SwapRequest {
        address sender;
        address recipient;
        uint256 nonce;
        uint256 expiry;
        address signerWallet;
        address signerToken;
        uint256 signerAmount;
        address senderToken;
        uint256 totalSenderAmount;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    uint256 public constant POINTS = 1000;

    uint256 public inputFeeInPoints = 0;
    uint256 public outputFeeInPoints = 0;

    address public feeVaultAddress = address(0);
    address public swapERC20Address = address(0);

    event FeeVaultAddressChangedEvent(address indexed sender, address newAddress);
    event SwapERC20AddressChangedEvent(address indexed sender, address newAddress);
    event InputFeeChangedEvent(address indexed sender, uint256 feeInPoints);
    event OutputFeeChangedEvent(address indexed sender, uint256 feeInPoints);

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
    /// @param _inputFeeInPoints The new fee in points
    function setInputFee(uint256 _inputFeeInPoints) public onlyOwner {
        inputFeeInPoints = _inputFeeInPoints;
        emit InputFeeChangedEvent(msg.sender, inputFeeInPoints);
    }

    /// @notice Set the output fee in points, ie 25 means 2.5 percent.
    ///         The output fee is collected after the conversion.
    /// @param _outputFeeInPoints The new fee in points
    function setOutputFee(uint256 _outputFeeInPoints) public onlyOwner {
        outputFeeInPoints = _outputFeeInPoints;
        emit OutputFeeChangedEvent(msg.sender, outputFeeInPoints);
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
    /// @param _sender Address which is sending the tokens
    /// @param _recipient Address to send the resulting tokens after collecting the output fee
    /// @param _nonce A one time nonce
    /// @param _expiry Date at which the original proposal will expire
    /// @param _signerWallet Address of the market maker wallet
    /// @param _signerToken Address of the token to convert to
    /// @param _signerAmount Amount of resulting token from the conversion
    /// @param _totalSenderAmount The amount to be sent before the input fee is collected.
    /// @param _v v part of the ECDSA signature
    /// @param _r r part of the ECDSA signature
    /// @param _s s part of the ECDSA signature
    function swap(
        address _sender,
        address _recipient,
        uint256 _nonce,
        uint256 _expiry,
        address _signerWallet,
        address _signerToken,
        uint256 _signerAmount,
        address _senderToken,
        uint256 _totalSenderAmount,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) public {
        require(feeVaultAddress != address(0), "invalid vault");
        require(swapERC20Address != address(0), "invalid swapper");

        SwapRequest memory swapRequest =
            SwapRequest(
                _sender,
                _recipient,
                _nonce,
                _expiry,
                _signerWallet,
                _signerToken,
                _signerAmount,
                _senderToken,
                _totalSenderAmount,
                _v,
                _r,
                _s
            );

        // first we move all the funds here
        require(
            IERC20_(swapRequest.senderToken).transferFrom(
                swapRequest.sender,
                address(this),
                swapRequest.totalSenderAmount
            ),
            "transfer failed 1"
        );

        // then we collect the input fee
        uint256 inputFee = calculateInputFee(swapRequest.totalSenderAmount);
        require(
            IERC20_(swapRequest.senderToken).transfer(feeVaultAddress, inputFee),
            "transfer failed 2"
        );

        uint256 senderAmountAfterFee = swapRequest.totalSenderAmount.sub(inputFee);

        // now we do the swap
        ISwapERC20(swapERC20Address).swap(
            address(this),
            swapRequest.nonce,
            swapRequest.expiry,
            swapRequest.signerWallet,
            swapRequest.signerToken,
            swapRequest.signerAmount,
            swapRequest.senderToken,
            senderAmountAfterFee,
            swapRequest.v,
            swapRequest.r,
            swapRequest.s
        );

        // now we collect the output fee
        uint256 outputFee = calculateOutputFee(swapRequest.signerAmount);
        require(
            IERC20_(swapRequest.signerToken).transfer(feeVaultAddress, outputFee),
            "transfer failed 3"
        );

        uint256 receiveAmountAfterFee = swapRequest.signerAmount.sub(outputFee);

        // now we send the user her due
        require(
            IERC20_(swapRequest.signerToken).transfer(
                swapRequest.recipient,
                receiveAmountAfterFee
            ),
            "transfer failed 4"
        );

        // emit the event
        emit SwapEvent(
            swapRequest.sender,
            swapRequest.recipient,
            swapRequest.senderToken,
            swapRequest.totalSenderAmount,
            inputFee,
            swapRequest.signerToken,
            receiveAmountAfterFee,
            outputFee
        );
    }
}
