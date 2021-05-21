pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicStandard.sol";

contract LoanTokenLogicLM is LoanTokenLogicStandard {
	function mintWithLM(address receiver, uint256 depositAmount) external nonReentrant hasEarlyAccessToken returns (uint256 minted) {
		return _mintWithLM(receiver, depositAmount);
	}

	function _mintWithLM(address receiver, uint256 depositAmount) internal returns (uint256 minted) {
		//mint the tokens for the receiver
		minted = _mintToken(receiver, depositAmount);

		//transfer the tokens from the receiver to the LM address
		_internalTransferFrom(receiver, liquidityMiningAddress, minted, minted);

		//inform the LM mining contract
		ILiquidityMining(liquidityMiningAddress).onTokensDeposited(receiver, minted);
	}

	function burnFromLM(address receiver, uint256 burnAmount) external nonReentrant returns (uint256 repayed) {
		repayed = _burnFromLM(receiver, burnAmount);
		//this needs to be here and not in _burnTokens because of the WRBTC implementation
		if (repayed != 0) {
			_safeTransfer(loanTokenAddress, receiver, repayed, "asset transfer failed");
		}
	}

	function _burnFromLM(address receiver, uint256 burnAmount) internal returns (uint256) {
		//withdraw pool tokens to the message sender, but LM rewards to the receiver
		ILiquidityMining(liquidityMiningAddress).withdraw(msg.sender, burnAmount, receiver);
		//burn the tokens of the msg.sender
		return _burnToken(burnAmount);
	}

	//todo: ensure that the user can still access his tokens on the old contract if this is changed
	//potentially only allow it to be set once
	function setLiquidityMiningAddress(address LMAddress) external onlyOwner {
		liquidityMiningAddress = LMAddress;
	}
}
