pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicStandard.sol";

contract LoanTokenLogicLM is LoanTokenLogicStandard {
	/**
	 * @notice deposit into the lending pool and optionally participate at the Liquidity Mining Program
	 * @param receiver the receiver of the tokens
	 * @param depositAmount The amount of underlying tokens provided on the loan. 
	 *						(Not the number of loan tokens to mint).
	 * @param useLM if true -> deposit the pool tokens into the Liquidity Mining contract
	 */
	function mint(address receiver, uint256 depositAmount, bool useLM) external nonReentrant returns (uint256 minted) {
		if(useLM) return _mintWithLM(receiver, depositAmount);
		else return _mintToken(receiver, depositAmount);
	}

	function _mintWithLM(address receiver, uint256 depositAmount) internal returns (uint256 minted) {
		//mint the tokens for the receiver
		minted = _mintToken(receiver, depositAmount);

		//transfer the tokens from the receiver to the LM address
		_internalTransferFrom(receiver, liquidityMiningAddress, minted, minted);

		//inform the LM mining contract
		ILiquidityMining(liquidityMiningAddress).onTokensDeposited(receiver, minted);
	}

	/**
	 * @notice withdraws from the lending pool and optionally retrieves the pool tokens from the 
	 *         Liquidity Mining Contract
	 * @param receiver the receiver of the underlying tokens
	 * @param burnAmount The amount of pool tokens to redeem.
	 * @param useLM if true -> deposit the pool tokens into the Liquidity Mining contract
	 */
	function burn(address receiver, uint256 burnAmount, bool useLM) external nonReentrant returns (uint256 redeemed) {
		if(useLM) redeemed = _burnFromLM(receiver, burnAmount);
		else redeemed = _burnToken(burnAmount);
		//this needs to be here and not in _burnTokens because of the WRBTC implementation
		if (redeemed != 0) {
			_safeTransfer(loanTokenAddress, receiver, redeemed, "asset transfer failed");
		}
	}

	function _burnFromLM(address receiver, uint256 burnAmount) internal returns (uint256) {
		//withdraw pool tokens to the message sender, but LM rewards to the receiver
		ILiquidityMining(liquidityMiningAddress).withdraw(msg.sender, burnAmount, receiver);
		//burn the tokens of the msg.sender
		return _burnToken(burnAmount);
	}

	/**
	 * @notice sets the liquidity mining contract address
	 * @param LMAddress the address of the liquidity mining contract
	 */
	function setLiquidityMiningAddress(address LMAddress) external onlyOwner {
		liquidityMiningAddress = LMAddress;
	}
}
