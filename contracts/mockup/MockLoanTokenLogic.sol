pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../modules/Affiliates.sol";
import "../connectors/loantoken/modules/LoanTokenLogicLM.sol";
import "../modules/interfaces/ProtocolAffiliatesInterface.sol";

contract MockLoanTokenLogic is LoanTokenLogicLM {
	/*function getAffiliatesUserReferrer(address user) public view returns (address) {
		return affiliatesUserReferrer[user]; // REFACTOR: will be useful if affiliatesUserReferrer visibillity is not public
	}*/

	function setAffiliatesReferrer(address user, address referrer) public {
		ProtocolAffiliatesInterface(sovrynContractAddress).setAffiliatesReferrer(user, referrer);
	}

	function setUserNotFirstTradeFlag(address user) public {
		ProtocolAffiliatesInterface(sovrynContractAddress).setUserNotFirstTradeFlag(user);
	}

	/*function initialize(address target) external onlyOwner {
		_setTarget(this.setAffiliatesUserReferrer.selector, target);
	}*/
}
