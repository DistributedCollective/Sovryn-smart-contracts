pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../interfaces/IERC20.sol";
import "../openzeppelin/Address.sol";
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/ECDSA.sol";

contract ProtocolTokenHandler is Ownable {
	using Address for address;
	using SafeERC20 for IERC20;
	using ECDSA for bytes32;

	/* Storage */

	address public protocolTokenAddress;
	uint256 public requiredCount = 2;
	mapping(address => bool) public isSigner;
	mapping(address => uint256) public userNonce;

	/* Events */

	event AddSigner(address indexed signer);
	event RemoveSigner(address indexed signer);
	event SetRequiredCount(uint256 indexed requiredCount);
	event Deposit(address indexed sender, uint256 amount);
	event Withdraw(address indexed caller, address indexed recipient, uint256 amount);

	/* Functions */

	/**
	 * @notice Deploy the contract and set protocol token address.
	 *
	 * @param protocolTokenAddress_ The address of protocol token.
	 * */
	constructor(address protocolTokenAddress_) public {
		require(protocolTokenAddress_.isContract(), "protocol token address should be contract address");
		protocolTokenAddress = protocolTokenAddress_;
	}

	/**
	 * @notice Owner function to add a signer.
	 *
	 * @param _signer The address of signer added.
	 * */
	function addSigner(address _signer) external onlyOwner {
		require(_signer != address(0), "signer address should not be zero address");
		require(!_signer.isContract(), "signer address should not be contract address");
		require(!isSigner[_signer], "signer set");

		isSigner[_signer] = true;

		emit AddSigner(_signer);
	}

	/**
	 * @notice Owner function to remove a signer.
	 *
	 * @param _signer The address of signer removed.
	 * */
	function removeSigner(address _signer) external onlyOwner {
		require(isSigner[_signer], "signer not set");

		isSigner[_signer] = false;

		emit RemoveSigner(_signer);
	}

	/**
	 * @notice Owner function to set the required number of signers.
	 *
	 * @param requiredCount_ The required amount of signs provided by users.
	 * */
	function setRequiredCount(uint256 requiredCount_) external onlyOwner {
		require(requiredCount_ > 0, "required amount of signs should larger than zero");

		requiredCount = requiredCount_;

		emit SetRequiredCount(requiredCount_);
	}

	/**
	 * @notice Deposit an amount of protocol tokens into this contract.
	 *
	 * @dev Before calling this function to deposit protocol tokens,
	 * users need approve this contract to be able to spend or transfer
	 * their protocol tokens.
	 *
	 * @param _amount The amount of protocol tokens deposited to this contract.
	 * */
	function deposit(uint256 _amount) external {
		require(_amount > 0, "amount should larger than zero");

		IERC20(protocolTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

		emit Deposit(msg.sender, _amount);
	}

	/**
	 * @notice Withdraw protocol tokens from this contract with signers verification.
	 *
	 * @param _recipient The address of recipient.
	 * @param _amount The amount of tokens to be withdrawn.
	 * @param _nonce The nonce to avoid replay attacks.
	 * @param _signs The array including signs from authorized signers, amount/length should equal to requiredCount.
	 * */
	function withdraw(
		address _recipient,
		uint256 _amount,
		uint256 _nonce,
		bytes[] calldata _signs
	) external {
		require(_amount > 0, "amount should larger than zero");

		uint256 balance_ = IERC20(protocolTokenAddress).balanceOf(address(this));
		require(balance_ >= _amount, "balance not enough");

		uint256 oldNonce = userNonce[msg.sender];
		require(_nonce > oldNonce, "nonce smaller than last know nonce");
		userNonce[msg.sender] = _nonce;

		bytes32 hash = keccak256(abi.encodePacked(_recipient, _amount, _nonce)).toEthSignedMessageHash();

		uint8 v;
		bytes32 r;
		bytes32 s;
		address signer;
		bytes memory sign;
		address[] memory verifiedSigners = new address[](requiredCount);

		for (uint256 i = 0; i < requiredCount; i++) {
			sign = _signs[i];
			require(sign.length == 65, "length of sign is wrong");

			assembly {
				r := mload(add(sign, 0x20))
				s := mload(add(sign, 0x40))
				v := add(0x1b, byte(0, mload(add(sign, 0x60))))
			}

			signer = ecrecover(hash, v, r, s);
			require(isSigner[signer], "signer not authorized");

			for (uint256 q = 0; q < i; q++) {
				require(signer != verifiedSigners[q], "signer verified");
			}

			verifiedSigners[i] = signer;
		}

		IERC20(protocolTokenAddress).safeTransfer(_recipient, _amount);

		emit Withdraw(msg.sender, _recipient, _amount);
	}
}
