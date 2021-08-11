pragma solidity 0.5.17;

import "../locked/ILockedSOV.sol";
import "../utils/AdminRole.sol";

contract LockedSOVRewardTransferLogicStorage is AdminRole {
	/// LockedSOV vault when reward transfer is performed
	ILockedSOV public lockedSOV;

	/// Determines the amount of tokens that will be unlocked and ready
	/// to be withdrawn
	uint256 public unlockedImmediatelyPercent;
}
