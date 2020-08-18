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
     * on loan opening minSourceTokenAmount = maxSourceTokenAmount and requiredDestTokenAmount = 0
     * on loan extension (swap interest) minSourceTokenAmount = maxSourceTokenAmount and requiredDestTokenAmount > 0 (partial spend of source tokens possible)
     * on loan closure minSourceTokenAmount <= maxSourceTokenAmount and requiredDestTokenAmount >= 0
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
        
        uint expectedRate = bancorNetwork.rateByPath(path, minSourceTokenAmount);
        
        if(requiredDestTokenAmount > 0){
            //in case er require a certain amount of tokens and can spend more than the minSourceTokenAmount
            //calculate the number of tokens to provide 
            if(maxSourceTokenAmount > minSourceTokenAmount && expectedRate < requiredDestTokenAmount){
                minSourceTokenAmount = estimateSourceTokenAmount(sourceTokenAddress, destTokenAddress, requiredDestTokenAmount, maxSourceTokenAmount, expectedRate);
                require(bancorNetwork.rateByPath(path, minSourceTokenAmount) >= requiredDestTokenAmount, "insufficient source tokens provided.");
            }
            expectedRate = requiredDestTokenAmount;
        }
        
        allowTransfer(minSourceTokenAmount, sourceTokenAddress, address(bancorNetwork));
        
        destTokenAmountReceived = bancorNetwork.convertByPath(path, minSourceTokenAmount, expectedRate, address(0), address(0), 0);
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
     * @param maxSourceTokenAmount the maximum number of source tokens to spend
     * @param expectedReturn the expected return for the minSourceTokenAmount
     * @return the estimated amount of source tokens needed
     * */
    function estimateSourceTokenAmount(address sourceTokenAddress, address destTokenAddress, uint requiredDestTokenAmount, uint maxSourceTokenAmount, uint expectedReturn) internal returns(uint256 estimatedSourceAmount){
        //logic like in SwapsImplKyber. query current rate from the price feed, add a 5% buffer and return this value
        //in case it's not bigger than maxSourceTokenAmount. else return maxSourceTokenAmount
        
        uint256 sourceToDestPrecision = IPriceFeeds(priceFeeds).queryPrecision(sourceTokenAddress, destTokenAddress);
        if (sourceToDestPrecision == 0) 
            return maxSourceTokenAmount;
            
        uint256 bufferMultiplier = sourceBufferPercent.add(10**20);

        estimatedSourceAmount = requiredDestTokenAmount
            .mul(sourceToDestPrecision)
            .div(expectedReturn);
            
        estimatedSourceAmount = estimatedSourceAmount // buffer yields more source
            .mul(bufferMultiplier)
            .div(10**20);

        if (estimatedSourceAmount == 0 || estimatedSourceAmount > maxSourceTokenAmount) 
            return maxSourceTokenAmount;

    }
    
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
        
        return bancorNetwork.rateByPath(path, sourceTokenAmount);
    }
    
    
}