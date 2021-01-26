pragma solidity ^0.5.17;

import "../../openzeppelin/ERC20Detailed.sol";
import "../../openzeppelin/IERC20_.sol";
import "../../openzeppelin/ERC20.sol";
import "../../openzeppelin/Ownable.sol";
import "../Staking/SafeMath96.sol";
import "../Staking/IStaking.sol";
import "../../token/IApproveAndCall.sol";

//TODO should be set as protocolTokenAddress (ProtocolSettings.setProtocolTokenAddress)
//TODO PriceFeeds._protocolTokenAddress ?
/**
 * Sovryn Reward Token
 */
contract RSOV is ERC20, ERC20Detailed, Ownable, SafeMath96, IApproveAndCall {
	string constant NAME = "Sovryn Reward Token";
	string constant SYMBOL = "RSOV";
	uint8 constant DECIMALS = 18;

	///@notice constants used for computing the vesting dates
	uint256 constant FOUR_WEEKS = 4 weeks;
	uint256 constant YEAR = 52 weeks;
	///@notice amount of tokens divided by this constant will be transferred
	uint96 constant DIRECT_TRANSFER_PART = 14;

	//4 bytes - 0x08c379a0 - method id
	//32 bytes - 2 parameters
	//32 bytes - bool, result
	//32 ... bytes - string, error message
	uint256 constant ERROR_MESSAGE_SHIFT = 68;

	///@notice the SOV token contract
	IERC20_ public SOV;
	///@notice the staking contract
	IStaking public staking;

	event Mint(address indexed sender, uint256 amount);
	event Burn(address indexed sender, uint256 amount);

	/**
	 * @notice creates reward token
	 * @param _SOV the SOV token address
	 * @param _staking the staking contract address
	 * */
	constructor(address _SOV, address _staking) public ERC20Detailed(NAME, SYMBOL, DECIMALS) {
		require(_SOV != address(0), "RSOV::SOV address invalid");
		require(_staking != address(0), "RSOV::staking address invalid");

		SOV = IERC20_(_SOV);
		staking = IStaking(_staking);
	}

	/**
	 * @notice holds SOV tokens and mints the respective amount of RSOV tokens
	 * @param _amount the amount of tokens to be mint
	 */
	function mint(uint96 _amount) public {
		_mintTo(msg.sender, _amount);
	}

	/**
	 * @notice holds SOV tokens and mints the respective amount of RSOV tokens
	 * @dev this function will be invoked from receiveApproval
	 * @dev SOV.approveAndCall -> this.receiveApproval -> this.mintWithApproval
	 * @param _sender the sender of SOV.approveAndCall
	 * @param _amount the amount of tokens to be mint
	 */
	function mintWithApproval(address _sender, uint96 _amount) public {
		//accepts calls only from receiveApproval function
		require(msg.sender == address(this), "unauthorized");

		_mintTo(_sender, _amount);
	}

	function _mintTo(address _sender, uint96 _amount) internal {
		require(_amount > 0, "RSOV::mint: amount invalid");

		//holds SOV tokens
		bool success = SOV.transferFrom(_sender, address(this), _amount);
		require(success);

		//mints RSOV tokens
		_mint(_sender, _amount);

		emit Mint(_sender, _amount);
	}

	/**
	 * @notice burns RSOV tokens and stakes the respective amount SOV tokens in the user's behalf
	 * @param _amount the amount of tokens to be burnt
	 */
	function burn(uint96 _amount) public {
		require(_amount > 0, "RSOV:: burn: amount invalid");

		//burns RSOV tokens
		_burn(msg.sender, _amount);

		//transfer 1/14 of amount directly to the user
		//if amount is too small it won't be transferred
		uint96 transferAmount = _amount / DIRECT_TRANSFER_PART;
		if (transferAmount > 0) {
			SOV.transfer(msg.sender, transferAmount);
			_amount -= transferAmount;
		}

		//stakes SOV tokens in the user's behalf
		SOV.approve(address(staking), _amount);

		staking.stakesBySchedule(_amount, FOUR_WEEKS, YEAR, FOUR_WEEKS, msg.sender, msg.sender);

		emit Burn(msg.sender, _amount);
	}

	function receiveApproval(
		address _sender,
		uint256 /*_amount*/,
		address /*_token*/,
		bytes memory _data
	) public {
		//accepts calls only from SOV token
		require(msg.sender == address(SOV), "unauthorized");

		//only mintWithApproval
		require(getSig(_data) == this.mintWithApproval.selector, "method is not allowed");

		(bool success, bytes memory returnData) = address(this).call(_data);
		if (!success) {
			if (returnData.length <= ERROR_MESSAGE_SHIFT) {
				revert("receiveApproval: Transaction execution reverted.");
			} else {
				revert(_addErrorMessage("receiveApproval: ", string(returnData)));
			}
		}
	}

	function getSig(bytes memory _data) internal pure returns (bytes4 sig) {
		assembly {
			sig := mload(add(_data, 32))
		}
	}

	function _addErrorMessage(string memory str1, string memory str2) internal pure returns (string memory) {
		bytes memory bytesStr1 = bytes(str1);
		bytes memory bytesStr2 = bytes(str2);
		string memory str12 = new string(bytesStr1.length + bytesStr2.length - ERROR_MESSAGE_SHIFT);
		bytes memory bytesStr12 = bytes(str12);
		uint256 j = 0;
		for (uint256 i = 0; i < bytesStr1.length; i++) {
			bytesStr12[j++] = bytesStr1[i];
		}
		for (uint256 i = ERROR_MESSAGE_SHIFT; i < bytesStr2.length; i++) {
			bytesStr12[j++] = bytesStr2[i];
		}
		return string(bytesStr12);
	}

}
