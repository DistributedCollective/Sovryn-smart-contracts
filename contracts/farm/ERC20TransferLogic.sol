pragma solidity 0.5.17;

import "./IRewardTransferLogic.sol";
import "./ERC20TransferLogicStorage.sol";
import "../interfaces/IERC20.sol";

contract ERC20TransferLogic is IRewardTransferLogic, ERC20TransferLogicStorage {
	event TokenAddressUpdated(address _newTokenAddress);

	/**
	 * @param _token Reward token to be distributed
	 */
	function initialize(address _token) public onlyAuthorized {
		setTokenAddress(_token);
	}

	function setTokenAddress(address _token) public onlyAuthorized {
		require(_token != address(0), "Invalid token address");
		token = IERC20(_token);
		emit TokenAddressUpdated(_token);
	}

	function getRewardTokenAddress() external view returns (address) {
		return address(token);
	}

	function senderToAuthorize() external view returns (address) {
		return address(this);
	}

	function transferReward(
		address _to,
		uint256 _value,
		bool // it doesn't matter if it's a withdrawal or not
	) external {
		token.transferFrom(msg.sender, _to, _value);
	}
}
