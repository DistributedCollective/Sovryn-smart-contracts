// SPDX-License-Identifier:MIT
pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

interface IERC20 {
    function name() external view returns (string memory);

    function totalSupply() external view returns (uint256);

    function balanceOf(address _who) external view returns (uint256);

    function transfer(address _to, uint256 _value) external returns (bool);

    function allowance(address _owner, address _spender)
        external
        view
        returns (uint256);

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool);

    function approve(address _spender, uint256 _value) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

interface ILiquidityPoolV2Converter {
    function addLiquidity(
        IERC20 _reserveToken,
        uint256 _amount,
        uint256 _minReturn
    ) external payable returns (uint256);

    function poolToken(IERC20 _reserveToken) external view returns (IERC20);
}

interface SovrynProtocol {
    struct Loan {
        bytes32 id; // id of the loan
        bytes32 loanParamsId; // the linked loan params id
        bytes32 pendingTradesId; // the linked pending trades id
        bool active; // if false, the loan has been fully closed
        uint256 principal; // total borrowed amount outstanding
        uint256 collateral; // total collateral escrowed for the loan
        uint256 startTimestamp; // loan start time
        uint256 endTimestamp; // for active loans, this is the expected loan end time, for in-active loans, is the actual (past) end time
        uint256 startMargin; // initial margin when the loan opened
        uint256 startRate; // reference rate when the loan opened for converting collateralToken to loanToken
        address borrower; // borrower of this loan
        address lender; // lender of this loan
    }

    function loans(bytes32 loanId) external view returns (Loan memory);

    function closeWithDepositWithSig(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount, // denominated in loanToken
        bytes calldata sig
    )
        external
        payable
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        );

    function depositCollateral(
        bytes32 loanId,
        uint256 depositAmount //Only for tokens
    ) external payable;
}

interface ILoanToken {
    function marginTrade(
        bytes32 loanId, // 0 if new loan
        uint256 leverageAmount,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralToken,
        address trader,
        bytes calldata loanDataBytes // arbitrary order data
    ) external payable returns (uint256, uint256);

    function loanTokenAddress() external view returns (address);

    function borrow(
        bytes32 loanId, // 0 if new loan
        uint256 withdrawAmount,
        uint256 initialLoanDuration, // duration in seconds
        uint256 collateralTokenSent, // if 0, loanId must be provided; any ETH sent must equal this value
        address collateralTokenAddress, // if address(0), this means ETH and ETH must be sent with the call or loanId must be provided
        address borrower,
        address receiver,
        bytes calldata // arbitrary order data (for future use) /*loanDataBytes*/
    ) external payable returns (uint256, uint256); // returns new principal and new collateral added to loan

    function mint(address receiver, uint256 depositAmount)
        external
        returns (uint256 mintAmount);
}

interface SwapsExternal {
    function swapExternal(
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        bytes calldata swapData
    )
        external
        payable
        returns (
            uint256 destTokenAmountReceived,
            uint256 sourceTokenAmountUsed
        );
}

contract Forwarding {
    address private owner;
    mapping(address => bool) private reservToken;

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "sender must be owner");
        _;
    }

    /*
     *  Events
     */
    event setReserveTokenEvent(address[] indexed token, address tokenSetter);
    event resetReserveTokenEvent(
        address[] indexed token,
        address tokenResetter
    );
    event addLiquidityEvent(address indexed receiver, uint256 poolShare);
    event depositLendEvent(address indexed receiver, uint256 shareAmmount);
    event marginTradeEvent(
        address indexed trader,
        uint256 newPrinicipal,
        uint256 newCollateral
    );
    event depositCollateralEvent(
        address indexed receiver,
        uint256 depositAmount
    );
    event borrowEvent(
        address indexed receiver,
        uint256 newPrinicipal,
        uint256 newCollateral
    );

    event closeWithDepositWithUserSigEvent(
        address indexed user,
        uint256 loanCloseAmmount,
        uint256 withdrawAmmount,
        address indexed withdrawToken
    );

    event swapExternalEvent(
        address indexed receiver,
        uint256 destTokenAmountReceived,
        uint256 sourceTokenAmountUsed
    );

    // @dev Allows to set  transferable token.
    /// @param tokenContract array  of unique transferable tokens.
    //Duplicate address can't be set here
    function setReserveToken(address[] memory tokenContract) public onlyOwner {
        for (uint256 i = 0; i < tokenContract.length; i++) {
            require(
                !reservToken[tokenContract[i]],
                "Already in our reserv token list"
            );
            reservToken[tokenContract[i]] = true;
        }
        emit setReserveTokenEvent(tokenContract, msg.sender);
    }

    // @dev Allows to reset  transferable token.
    /// @param tokenContract array  of unique transferable tokens.
    //Duplicate address can't be reset here
    function resetReserveToken(address[] memory tokenContract)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < tokenContract.length; i++) {
            require(
                reservToken[tokenContract[i]],
                "Token Address is not in  our reserv list"
            );
            reservToken[tokenContract[i]] = false;
        }
        emit resetReserveTokenEvent(tokenContract, msg.sender);
    }

    // add modifier checkReserveToken(tokenContract)in doTransferFrom(), Secure  transferFrom Method using checkReserveToken modifier
    modifier checkReserveToken(address tokenContract) {
        require(reservToken[tokenContract], "This token is not in our reserve");
        _;
    }

    //when call doTransferFrom() first transfer token that is alreday approved by user and then appove ammount tokens to specifc contract.
    //where spender is that calledContract and owner if forwarding contract
    /// @param tokenContract erc20 token.
    /// @param calledContract address for which ammount is to approved .
    /// @param ammount Ammount to be tranfer to specific contract .
    function doTransferFrom(
        address tokenContract,
        address calledContract,
        uint256 ammount
    ) internal returns (bool approvedSuccess) {
        require(
            (
                IERC20(tokenContract).transferFrom(
                    msg.sender,
                    address(this),
                    ammount
                )
            ),
            "Not enough tokens to approve"
        );
        approvedSuccess = IERC20(tokenContract).approve(
            calledContract,
            ammount
        );
    }

    /**
     * @dev increases the pool's liquidity and mints new shares in the pool to the caller
     *@param LiquidityPoolContract   AMM LiquidityPool contract Address
     * @param reserveToken    address of the reserve token to add liquidity to
     * @param tokenAmmount          amount of liquidity to add
     * @param minReturn       minimum return-amount of pool tokens
     *
     * @return  amount of pool tokens minted
     */

    function addLiquidity(
        address LiquidityPoolContract,
        address reserveToken,
        uint256 tokenAmmount,
        uint256 minReturn
    ) public returns (uint256 poolShare) {
        require(
            doTransferFrom(reserveToken, LiquidityPoolContract, tokenAmmount),
            "Not approved tokens"
        );
        poolShare = ILiquidityPoolV2Converter(LiquidityPoolContract)
            .addLiquidity(IERC20(reserveToken), tokenAmmount, minReturn);
        IERC20 poolToken =
            ILiquidityPoolV2Converter(LiquidityPoolContract).poolToken(
                IERC20(reserveToken)
            );
        require(
            poolToken.transfer(msg.sender, poolShare),
            "contract not transfer minted tokens"
        );
        emit addLiquidityEvent(msg.sender, poolShare);
    }

    /**
     * @dev deposit erc20token to calledContract mints new shares in the pool to the caller
     *@param loanTokenContract LoanToken contract address
     * @param tokenContract   erc20token which user provide to deposit their their erc20token
     * @param receiver          receiver of depositing tokens
     * @param depositAmount       Deposited Ammount
     *
     * @return  amount of pool tokens minted
     */
    function depositLendToken(
        address loanTokenContract,
        address tokenContract,
        address receiver,
        uint256 depositAmount
    ) public {
        require(
            doTransferFrom(tokenContract, loanTokenContract, depositAmount),
            "Not enough tokens to approve"
        );
        uint256 _shareAmmount =
            ILoanToken(loanTokenContract).mint(receiver, depositAmount);
        emit depositLendEvent(receiver, _shareAmmount);
    }

    /** *dev allow to marginTrade and  immediately get into a positions and fund will be held by protocol itself
     *@param loanTokenContract LoanTokenContract address
     * @param loanId the ID of the loan, 0 for a new loan
     * @param leverageAmount as 2x,3x,4x pass leverageAmount as  2*10**18(for leveraging 2X)
     * @param loanTokenSent the amount of Loan token sent
     * @param collateralTokenSent the amount of collateral token sent
     * @param collateralTokenAddress the address of the tokenn to be used as collateral. cannot be the loan token address
     * @param trader trader address
     *@param loanDataBytes loanData maybe used in future
     * */
    function marginTrading(
        address loanTokenContract,
        bytes32 loanId,
        uint256 leverageAmount,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        address trader,
        bytes memory loanDataBytes
    ) public returns (uint256 newPrinicipal, uint256 newCollateral) {
        if (collateralTokenSent != 0 && collateralTokenAddress != address(0))
            require(
                doTransferFrom(
                    collateralTokenAddress,
                    loanTokenContract,
                    collateralTokenSent
                ),
                "Not enough tokens to approve"
            );
        if (loanTokenSent != 0) {
            address loanTokenAddress =
                ILoanToken(loanTokenContract).loanTokenAddress();
            require(
                doTransferFrom(
                    loanTokenAddress,
                    loanTokenContract,
                    loanTokenSent
                ),
                "not enough tokens to approve"
            );
        }
        (newPrinicipal, newCollateral) = ILoanToken(loanTokenContract)
            .marginTrade(
            loanId,
            leverageAmount,
            loanTokenSent,
            collateralTokenSent,
            collateralTokenAddress,
            trader,
            loanDataBytes
        );
        emit marginTradeEvent(trader, newPrinicipal, newCollateral);
    }

    /**  allow to Top-Up their previous/exiting position
    *@param protocolContract protocol contract address
    *@param tokenContract erc20 tokens which is to be deposited
    * @param loanId the ID of the loan, 0 for a new loan
    * @param depositAmount the amount to be deposited
     
     * */
    function depositCollateral(
        address protocolContract,
        address tokenContract,
        bytes32 loanId,
        uint256 depositAmount
    ) public {
        require(
            doTransferFrom(tokenContract, protocolContract, depositAmount),
            "Not enough tokens to approve"
        );
        SovrynProtocol(protocolContract).depositCollateral(
            loanId,
            depositAmount
        );
        emit depositCollateralEvent(msg.sender, depositAmount);
    }

    /**
     * borrows funds from the pool .
     *@param loanTokenContract LoanTokenContract address
     * @param loanId the ID of the loan, 0 for a new loan
     * @param withdrawAmount the amount to be withdrawn (actually borrowed)
     * @param initialLoanDuration the duration of the loan in seconds. if the loan is not paid back until then, it'll need to be rolled over
     * @param collateralTokenSent the amount of collateral token sent (150% of the withdrawn amount worth in collateral tokenns)
     * @param collateralTokenAddress the address of the tokenn to be used as collateral. cannot be the loan token address
     * @param borrower the one paying for the collateral
     * @param receiver the one receiving the withdrawn amount
     * */
    function borrow(
        address loanTokenContract,
        bytes32 loanId, // 0 if new loan
        uint256 withdrawAmount,
        uint256 initialLoanDuration, // duration in seconds
        uint256 collateralTokenSent, // if 0, loanId must be provided; any ETH sent must equal this value
        address collateralTokenAddress, // if address(0), this means ETH and ETH must be sent with the call or loanId must be provided
        address borrower,
        address receiver,
        bytes memory /*loanDataBytes*/
    ) public returns (uint256 newPrinicipal, uint256 newCollateral) {
        require(
            doTransferFrom(
                collateralTokenAddress,
                loanTokenContract,
                collateralTokenSent
            ),
            "Not enough tokens to approve"
        );
        (newPrinicipal, newCollateral) = ILoanToken(loanTokenContract).borrow(
            loanId,
            withdrawAmount,
            initialLoanDuration,
            collateralTokenSent,
            collateralTokenAddress,
            borrower,
            receiver,
            bytes("")
        );
        emit borrowEvent(receiver, newPrinicipal, newCollateral);
    }

    /**
     * Closes a loan by doing a deposit
     *@param protocolContract protocolContract address
     * @param loanId the id of the loan
     * @param receiver the receiver of the remainder
     * @param depositAmount defines how much of the position should be closed. It is denominated in loan tokens.
     *       depositAmount > principal, the complete loan will be closed
     *       else deposit amount (partial closure)
     * @param sig user signature
     **/
    function closeWithDepositWithUserSig(
        address protocolContract,
        address tokenContract,
        bytes32 loanId,
        address receiver,
        uint256 depositAmount,
        bytes memory sig
    )
        public
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        )
    {
        SovrynProtocol.Loan memory loanLocal =
            SovrynProtocol(protocolContract).loans(loanId);
        address loanBorrower = loanLocal.borrower;
        require(msg.sender == loanBorrower, "unauthorized");

        require(
            doTransferFrom(tokenContract, protocolContract, depositAmount),
            "Not enough tokens to approve"
        );
        (loanCloseAmount, withdrawAmount, withdrawToken) = SovrynProtocol(
            protocolContract
        )
            .closeWithDepositWithSig(loanId, receiver, depositAmount, sig);
        emit closeWithDepositWithUserSigEvent(
            receiver,
            loanCloseAmount,
            withdrawAmount,
            withdrawToken
        );
    }

    //  Swapping tokens
    function swapExternal(
        address _calledContract,
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        bytes memory swapData
    )
        public
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        require(
            doTransferFrom(sourceToken, _calledContract, sourceTokenAmount),
            "not enough tokens to approve"
        );
        (destTokenAmountReceived, sourceTokenAmountUsed) = SwapsExternal(
            _calledContract
        )
            .swapExternal(
            sourceToken,
            destToken,
            receiver,
            returnToSender,
            sourceTokenAmount,
            requiredDestTokenAmount,
            swapData
        );
        emit swapExternalEvent(
            receiver,
            destTokenAmountReceived,
            sourceTokenAmountUsed
        );
    }
}
