pragma solidity 0.5.17;

import "../../core/State.sol";
import "../../feeds/IPriceFeeds.sol";
import "../../openzeppelin/SafeERC20.sol";
import "../ISwapsImpl.sol";
import "./interfaces/ISovrynSwapNetwork.sol";
import "./interfaces/IContractRegistry.sol";

contract SwapsImplSovrynSwap is State, ISwapsImpl {
	using SafeERC20 for IERC20;

	// bytes32 contractName = hex"42616e636f724e6574776f726b"; // "SovrynSwapNetwork"

	function getContractHexName(string memory source) public pure returns (bytes32 result) {
		assembly {
			result := mload(add(source, 32))
		}
	}

	/**
	 * looks up the sovryn swap network contract registered at the given address
	 * @param sovrynSwapRegistryAddress the address of the registry
	 * */
	function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress) public view returns (ISovrynSwapNetwork) {
		// state variable sovrynSwapContractRegistryAddress is part of State.sol and set in ProtocolSettings.sol
		//and this function needs to work without delegate call as well -> therefore pass it
		IContractRegistry contractRegistry = IContractRegistry(sovrynSwapRegistryAddress);
		return ISovrynSwapNetwork(contractRegistry.addressOf(getContractHexName("SovrynSwapNetwork")));
	}

	/**
	 * swaps the source token for the destination token on the oracle based amm.
	 * on loan opening: minSourceTokenAmount = maxSourceTokenAmount and requiredDestTokenAmount = 0
	 *      -> swap the minSourceTokenAmount
	 * on loan rollover: (swap interest) minSourceTokenAmount = 0, maxSourceTokenAmount = complete collateral and requiredDestTokenAmount > 0
	 *      -> amount of required source tokens to swap is estimated (want to fill requiredDestTokenAmount, not more). maxSourceTokenAMount is not exceeded.
	 * on loan closure: minSourceTokenAmount <= maxSourceTokenAmount and requiredDestTokenAmount >= 0
	 *      -> same as on rollover. minimum amount is not considered at all.
	 * @param sourceTokenAddress the address of the source tokens
	 * @param destTokenAddress the address of the destination tokens
	 * @param receiverAddress the address to receive the swapped tokens
	 * @param returnToSenderAddress the address to return unspent tokens to (when called by the protocol, it's always the protocol contract)
	 * @param minSourceTokenAmount the minimum amount of source tokens to swapped (only considered if requiredDestTokens == 0)
	 * @param maxSourceTokenAmount the maximum amount of source tokens to swapped
	 * @param requiredDestTokenAmount the required amount of destination tokens
	 * **/

	function internalSwap(
		address sourceTokenAddress,
		address destTokenAddress,
		address receiverAddress,
		address returnToSenderAddress,
		uint256 minSourceTokenAmount,
		uint256 maxSourceTokenAmount,
		uint256 requiredDestTokenAmount
	) public returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed) {
		require(sourceTokenAddress != destTokenAddress, "source == dest");
		require(supportedTokens[sourceTokenAddress] && supportedTokens[destTokenAddress], "invalid tokens");

		ISovrynSwapNetwork sovrynSwapNetwork = getSovrynSwapNetworkContract(sovrynSwapContractRegistryAddress);
		IERC20[] memory path = sovrynSwapNetwork.conversionPath(IERC20(sourceTokenAddress), IERC20(destTokenAddress));

		uint256 minReturn = 0;
		sourceTokenAmountUsed = minSourceTokenAmount;

		//if the required amount of destination tokens is passed, we need to calculate the estimated amount of source tokens
		//regardless of the minimum source token amount (name is misleading)
		if (requiredDestTokenAmount > 0) {
			sourceTokenAmountUsed = estimateSourceTokenAmount(
				sourceTokenAddress,
				destTokenAddress,
				requiredDestTokenAmount,
				maxSourceTokenAmount
			);
			//sovrynSwapNetwork.rateByPath does not return a rate, but instead the amount of destination tokens returned
			require(
				sovrynSwapNetwork.rateByPath(path, sourceTokenAmountUsed) >= requiredDestTokenAmount,
				"insufficient source tokens provided."
			);
			minReturn = requiredDestTokenAmount;
		} else if (sourceTokenAmountUsed > 0) {
			//for some reason the sovryn swap network tends to return a bit less than the expected rate.
			minReturn = sovrynSwapNetwork.rateByPath(path, sourceTokenAmountUsed).mul(995).div(1000);
		}

		require(sourceTokenAmountUsed > 0, "cannot swap 0 tokens");

		allowTransfer(sourceTokenAmountUsed, sourceTokenAddress, address(sovrynSwapNetwork));

		//note: the kyber connector uses .call() to interact with kyber to avoid bubbling up. here we allow bubbling up.
		destTokenAmountReceived = sovrynSwapNetwork.convertByPath(path, sourceTokenAmountUsed, minReturn, address(0), address(0), 0);

		//if the sender is not the protocol (calling with delegatecall), return the remainder to the specified address.
		//note: for the case that the swap is used without the protocol. not sure if it should, though. needs to be discussed.
		if (returnToSenderAddress != address(this)) {
			if (sourceTokenAmountUsed < maxSourceTokenAmount) {
				// send unused source token back
				IERC20(sourceTokenAddress).safeTransfer(returnToSenderAddress, maxSourceTokenAmount - sourceTokenAmountUsed);
			}
		}
	}

	/**
	 * check is the existing allowance suffices to transfer the needed amount of tokens.
	 * if not, allows the transfer of an arbitrary amount of tokens.
	 * @param tokenAmount the amount to transfer
	 * @param tokenAddress the address of the token to transfer
	 * @param sovrynSwapNetwork the address of the sovrynSwap network contract.
	 * */
	function allowTransfer(
		uint256 tokenAmount,
		address tokenAddress,
		address sovrynSwapNetwork
	) internal {
		uint256 tempAllowance = IERC20(tokenAddress).allowance(address(this), sovrynSwapNetwork);
		if (tempAllowance < tokenAmount) {
			IERC20(tokenAddress).safeApprove(sovrynSwapNetwork, uint256(-1));
		}
	}

	/**
	 * calculates the number of source tokens to provide in order to obtain the required destination amount.
	 * @param sourceTokenAddress the address of the source token address
	 * @param destTokenAddress the address of the destination token address
	 * @param requiredDestTokenAmount the number of destination tokens needed
	 * @param maxSourceTokenAmount the maximum number of source tokens to spend
	 * @return the estimated amount of source tokens needed. minimum: minSourceTokenAmount, maximum: maxSourceTokenAmount
	 * */
	function estimateSourceTokenAmount(
		address sourceTokenAddress,
		address destTokenAddress,
		uint256 requiredDestTokenAmount,
		uint256 maxSourceTokenAmount
	) internal view returns (uint256 estimatedSourceAmount) {
		uint256 sourceToDestPrecision = IPriceFeeds(priceFeeds).queryPrecision(sourceTokenAddress, destTokenAddress);
		if (sourceToDestPrecision == 0) return maxSourceTokenAmount;

		//compute the expected rate for the maxSourceTokenAmount -> if spending less, we can't get a worse rate.
		uint256 expectedRate =
			internalExpectedRate(sourceTokenAddress, destTokenAddress, maxSourceTokenAmount, sovrynSwapContractRegistryAddress);

		//compute the source tokens needed to get the required amount with the worst case rate
		estimatedSourceAmount = requiredDestTokenAmount.mul(sourceToDestPrecision).div(expectedRate);

		//if the actual rate is exactly the same as the worst case rate, we get rounding issues. So, add a small buffer.
		//buffer = min(estimatedSourceAmount/1000 , sourceBuffer) with sourceBuffer = 10000
		uint256 buffer = estimatedSourceAmount.div(1000);
		if (buffer > sourceBuffer) buffer = sourceBuffer;
		estimatedSourceAmount = estimatedSourceAmount.add(buffer);

		//never spend more than the maximum
		if (estimatedSourceAmount == 0 || estimatedSourceAmount > maxSourceTokenAmount) return maxSourceTokenAmount;
	}

	/**
	 * returns the expected rate for 1 source token when exchanging the given amount of source tokens
	 * @param sourceTokenAddress the address of the source token contract
	 * @param destTokenAddress the address of the destination token contract
	 * @param sourceTokenAmount the amount of source tokens to get the rate for
	 * */
	function internalExpectedRate(
		address sourceTokenAddress,
		address destTokenAddress,
		uint256 sourceTokenAmount,
		address sovrynSwapContractRegistryAddress
	) public view returns (uint256) {
		ISovrynSwapNetwork sovrynSwapNetwork = getSovrynSwapNetworkContract(sovrynSwapContractRegistryAddress);
		IERC20[] memory path = sovrynSwapNetwork.conversionPath(IERC20(sourceTokenAddress), IERC20(destTokenAddress));
		//is returning the total amount of destination tokens
		uint256 expectedReturn = sovrynSwapNetwork.rateByPath(path, sourceTokenAmount);

		//return the rate for 1 token with 18 decimals
		return expectedReturn.mul(10**18).div(sourceTokenAmount);
	}

	/**
	 * returns the expected return amount when exchanging the given amount of source tokens
	 * @param sourceTokenAddress the address of the source token contract
	 * @param destTokenAddress the address of the destination token contract
	 * @param sourceTokenAmount the amount of source tokens to get the return for
	 * */
	function internalExpectedReturn(
		address sourceTokenAddress,
		address destTokenAddress,
		uint256 sourceTokenAmount,
		address sovrynSwapContractRegistryAddress
	) public view returns (uint256 expectedReturn) {
		ISovrynSwapNetwork sovrynSwapNetwork = getSovrynSwapNetworkContract(sovrynSwapContractRegistryAddress);
		IERC20[] memory path = sovrynSwapNetwork.conversionPath(IERC20(sourceTokenAddress), IERC20(destTokenAddress));
		//is returning the total amount of destination tokens
		expectedReturn = sovrynSwapNetwork.rateByPath(path, sourceTokenAmount);
	}
}
