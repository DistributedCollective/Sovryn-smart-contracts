pragma solidity 0.5.17;

import "../../core/State.sol";
import "../../feeds/IPriceFeeds.sol";
import "../../openzeppelin/SafeERC20.sol";
import "../ISwapsImpl.sol";
import "./interfaces/IBancorNetwork.sol";
import "./interfaces/IContractRegistry.sol";


contract SwapsImplBancor is State, ISwapsImpl {
    using SafeERC20 for IERC20;
    
    address contractRegistryAddress = 0x52Ae12ABe5D8BD778BD5397F99cA900624CfADD4;
    bytes32 contractName = hex"42616e636f724e6574776f726b"; // "BancorNetwork"
    
    function getBancorNetworkContract() public view returns(IBancorNetwork){
        IContractRegistry contractRegistry = IContractRegistry(contractRegistryAddress);
        return IBancorNetwork(contractRegistry.addressOf(contractName));
    }
    
    /**
     * swaps the source token for the destination token on the oracle based amm.
     * on loan opening: minSourceTokenAmount = maxSourceTokenAmount and requiredDestTokenAmount = 0
     * on loan extension: (swap interest) minSourceTokenAmount = 0, maxSourceTokenAmount = complete collateral and requiredDestTokenAmount > 0 
     *  (amount of source tokens used needs to be estimated)
     * on loan closure: minSourceTokenAmount <= maxSourceTokenAmount and requiredDestTokenAmount >= 0
     *  (excess is going to the borrower)
     * **/
    function internalSwap(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        address returnToSenderAddress,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount)
        public
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        require(sourceTokenAddress != destTokenAddress, "source == dest");
        require(supportedTokens[sourceTokenAddress] && supportedTokens[destTokenAddress], "invalid tokens");
        
        IBancorNetwork bancorNetwork = getBancorNetworkContract();
        IERC20[] memory path = bancorNetwork.conversionPath(
            IERC20(sourceTokenAddress),
            IERC20(destTokenAddress)
        );
        
        uint expectedReturn = 0;
        if(minSourceTokenAmount > 0){
            //bancorNetwork.rateByPath does not return a rate, but instead the amount of destination tokens returned
            expectedReturn = bancorNetwork.rateByPath(path, minSourceTokenAmount);
        }
        
        if(requiredDestTokenAmount > 0){
            //in case we require a certain amount of tokens and can spend more than the minSourceTokenAmount
            //calculate the number of tokens to provide 
            if(maxSourceTokenAmount > minSourceTokenAmount && expectedReturn < requiredDestTokenAmount){
                minSourceTokenAmount = estimateSourceTokenAmount(sourceTokenAddress, destTokenAddress, requiredDestTokenAmount, minSourceTokenAmount, maxSourceTokenAmount);
                require(bancorNetwork.rateByPath(path, minSourceTokenAmount) >= requiredDestTokenAmount, "insufficient source tokens provided.");
            }
            expectedReturn = requiredDestTokenAmount;
        }
        
        allowTransfer(minSourceTokenAmount, sourceTokenAddress, address(bancorNetwork));
        
        destTokenAmountReceived = bancorNetwork.convertByPath(path, minSourceTokenAmount, expectedReturn, address(0), address(0), 0);
        
        //todo: check if anythinngs needs to be returned to the sender
    }
    
    /**
     * check is the existing allowance suffices to transfer the needed amount of tokens. 
     * if not, allows the transfer of an arbitrary amount of tokens.
     * @param tokenAmount the amount to transfer
     * @param tokenAddress the address of the token to transfer
     * @param bancorNetwork the address of the bancor network contract.
     * */
    function allowTransfer(uint256 tokenAmount, address tokenAddress, address bancorNetwork) internal{
        uint256 tempAllowance = IERC20(tokenAddress).allowance(address(this), bancorNetwork);
        if (tempAllowance < tokenAmount) {
            IERC20(tokenAddress).safeApprove(
                bancorNetwork,
                uint256(-1)
            );
        }
    }
    
    /**
     * calculates the number of source tokens to provide in order to obtain the required destination amount.
     * @param sourceTokenAddress the address of the source token address
     * @param destTokenAddress the address of the destination token address
     * @param requiredDestTokenAmount the number of destination tokens needed
     * @param minSourceTokenAmount the minimum number of source tokens to spend
     * @param maxSourceTokenAmount the maximum number of source tokens to spend
     * @return the estimated amount of source tokens needed
     * */
    function estimateSourceTokenAmount(address sourceTokenAddress, address destTokenAddress, uint requiredDestTokenAmount, uint minSourceTokenAmount, uint maxSourceTokenAmount) internal returns(uint256 estimatedSourceAmount){
        //logic like in SwapsImplKyber. query current rate from the price feed, add a 5% buffer and return this value
        //in case it's not bigger than maxSourceTokenAmount. else return maxSourceTokenAmount
        
        uint256 sourceToDestPrecision = IPriceFeeds(priceFeeds).queryPrecision(sourceTokenAddress, destTokenAddress);
        if (sourceToDestPrecision == 0) 
            return maxSourceTokenAmount;
        
        //compute the expected rate for the maxSourceTokenAmount -> if spending less, we can't get a worse rate.
        uint256 expectedRate = internalExpectedRate(sourceTokenAddress, destTokenAddress, maxSourceTokenAmount);
        
        //compute the source tokens needed to get the required amount with the worst case rate
        estimatedSourceAmount = requiredDestTokenAmount
            .mul(sourceToDestPrecision)
            .div(expectedRate);
        
        //always spend the minimum
        if(estimatedSourceAmount == 0 || estimatedSourceAmount < minSourceTokenAmount)
            return minSourceTokenAmount;
        //never spend more than the maximum
        else if (estimatedSourceAmount > maxSourceTokenAmount) 
            return maxSourceTokenAmount;

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
        uint256 sourceTokenAmount)
        public
        view 
        returns (uint256)
    {
        IBancorNetwork bancorNetwork = getBancorNetworkContract();
        IERC20[] memory path = bancorNetwork.conversionPath(
            IERC20(sourceTokenAddress),
            IERC20(destTokenAddress)
        );
        //is returning the total amount of destination tokens
        uint256 expectedReturn = bancorNetwork.rateByPath(path, sourceTokenAmount);

        //return the rate for 1 token with 18 decimals
        return expectedReturn.mul(10**18).div(sourceTokenAmount);
    }
    
    
}