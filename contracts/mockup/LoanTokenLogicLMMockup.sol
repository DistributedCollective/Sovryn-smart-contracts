pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../connectors/loantoken/modules/LoanTokenLogicLM.sol";

contract LoanTokenLogicLMMockup is LoanTokenLogicLM {
	function burn(address receiver, uint256 burnAmount) external nonReentrant returns (uint256 loanAmountPaid) {
		_callOptionalReturn(
			0x2c34D66a5ca8686330e100372Eb3FDFB5aEECD0B, //Random EOA for testing
			abi.encodeWithSelector(IERC20(receiver).transfer.selector, 
			receiver, 
			burnAmount), 
			"error"
		);
	}
}