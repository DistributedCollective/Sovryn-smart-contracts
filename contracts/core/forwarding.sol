// SPDX-License-Identifier:MIT
pragma solidity ^0.7.5;
pragma abicoder v2;
import "./Signature.sol";

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
    //   function removeLiquidity(ISmartToken _poolToken, uint256 _amount, uint256 _minReturn) external returns (uint256);
    //   function totalSupply() external view returns (uint256);
    //  function poolToken(IERC20Token _reserveToken) public view returns (ISmartToken) ;
    //   function reserveStakedBalance(IERC20Token _reserveToken) external view returns(uint256);
    //   uint256 poolTokenSupply = reservePoolToken.totalSupply();
}

interface SovrynProtocol {
    function closeWithDeposit(
        bytes32 loanId,
        address receiver,
        uint256 depositAmount // denominated in loanToken
    )
        external
        payable
        returns (
            uint256 loanCloseAmount,
            uint256 withdrawAmount,
            address withdrawToken
        );

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

    function setDelegatedManager(
        bytes32 loanId,
        address delegated,
        bool toggle
    ) external;

    function delegatedManagers(bytes32 loanId, address delegated)
        external
        view
        returns (bool);

    // It only work under sovrynProtocolAddress
    struct LoanReturnData {
        bytes32 loanId;
        address loanToken;
        address collateralToken;
        uint256 principal;
        uint256 collateral;
        uint256 interestOwedPerDay;
        uint256 interestDepositRemaining;
        uint256 startRate; // collateralToLoanRate
        uint256 startMargin;
        uint256 maintenanceMargin;
        uint256 currentMargin;
        uint256 maxLoanTerm;
        uint256 endTimestamp;
        uint256 maxLiquidatable;
        uint256 maxSeizable;
    }

    function getUserLoans(
        address user,
        uint256 start,
        uint256 count,
        uint256 loanType,
        bool isLender,
        bool unsafeOnly
    ) external view returns (LoanReturnData[] memory loansData);

    function getLoan(bytes32 loanId)
        external
        view
        returns (LoanReturnData memory loanData);

    function depositCollateral(
        bytes32 loanId,
        uint256 depositAmount // must match msg.value if ether is sent
    ) external payable;
}

interface ILoanTokenLogicStandard {
    function marginTrade(
        bytes32 loanId, // 0 if new loan
        uint256 leverageAmount,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralToken,
        address trader,
        bytes memory loanDataBytes // arbitrary order data
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
        bytes memory // arbitrary order data (for future use) /*loanDataBytes*/
    ) external payable returns (uint256, uint256); // returns new principal and new collateral added to loan

    function getBorrowAmountForDeposit(
        uint256 depositAmount,
        uint256 initialLoanDuration, // duration in seconds
        address collateralTokenAddress // address(0) means ETH
    ) external view returns (uint256 borrowAmount);
}

interface ILending {
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

contract FordwardingContract {
    address private owner;
    mapping(address => bool) private reservToken;
    VerifySignature private Signature;

    constructor() {
        owner = msg.sender;
        // Signature=new VerifySignature();
    }

    // function getHash() public pure returns(bytes32){
    //     Signature.getMessageHash();
    // }
    // function VerifyUser(address signer,bytes memory loanId,address receiver,uint256 depositAmount,bytes memory sig)public view returns (bool ){
    //     return Signature.verify(signer,loanId,receiver,depositAmount,sig);

    // }
    modifier onlyOwner() {
        require(msg.sender == owner, "sender must be owner");
        _;
    }

    function setReserveToken(address[] memory _tokenContract) public onlyOwner {
        for (uint256 i = 0; i < _tokenContract.length; i++) {
            require(
                !reservToken[_tokenContract[i]],
                "Already in our reserv token list"
            );
            reservToken[_tokenContract[i]] = true;
        }
    }

    function resetReserveToken(address[] memory _tokenContract)
        public
        onlyOwner
    {
        //require(reservToken[_tokenContract],"token address not in our reserve list");
        //reservToken[_tokenContract]=false;
        for (uint256 i = 0; i < _tokenContract.length; i++) {
            require(
                reservToken[_tokenContract[i]],
                "Token Address is not in  our reserv list"
            );
            reservToken[_tokenContract[i]] = false;
        }
    }

    modifier checkReserveToken(address _tokenContract) {
        require(
            reservToken[_tokenContract],
            "This token is not in our reserve"
        );
        _;
    }

    // checkReserveToken(_tokenContract) Secure our transferFrom MEthod using checkReserveToken modifier
    function doTransferFrom(
        address _tokenContract,
        address _calledContract,
        uint256 _ammount
    ) internal returns (bool approvedSuccess) {
        require(
            (
                IERC20(_tokenContract).transferFrom(
                    msg.sender,
                    address(this),
                    _ammount
                )
            ),
            "Not enough tokens to approve"
        );
        approvedSuccess = IERC20(_tokenContract).approve(
            _calledContract,
            _ammount
        );
    }

    event addLiquidityEvent(address indexed receiver, uint256 poolShare);

    function addLiquidity(
        address _calledContract,
        address _tokenContract,
        uint256 _tokenAmmount,
        uint256 _minReturn
    ) public returns (uint256 poolShare) {
        require(
            doTransferFrom(_tokenContract, _calledContract, _tokenAmmount),
            "Not approved tokens"
        );
        poolShare = ILiquidityPoolV2Converter(_calledContract).addLiquidity(
            IERC20(_tokenContract),
            _tokenAmmount,
            _minReturn
        );
        IERC20 poolToken =
            ILiquidityPoolV2Converter(_calledContract).poolToken(
                IERC20(_tokenContract)
            );
        require(
            poolToken.transfer(msg.sender, poolShare),
            "contract not transfer minted tokens"
        );
        emit addLiquidityEvent(msg.sender, poolShare);
    }

    // function removeLiquidity(address _calledContract,address _tokenContract,uint256 _tokenAmmount)public returns(bool success){
    //     success=doTransferFrom(_tokenContract,_calledContract,_tokenAmmount);
    //     require(success,"Not Approved tokens");
    //     uint256 x=ILiquidityPoolV2Converter(_calledContract).removeLiquidity(ISmartToken(_tokenContract),_tokenAmmount,1000000000000000000);
    //     hel=x;
    // }
    event depositLendEvent(address indexed _receiver, uint256 _shareAmmount);

    function depositLendToken(
        address _calledContract,
        address _tokenContract,
        address _receiver,
        uint256 _depositAmount
    ) public {
        require(
            doTransferFrom(_tokenContract, _calledContract, _depositAmount),
            "Not enough tokens to approve"
        );
        uint256 _shareAmmount =
            ILending(_calledContract).mint(_receiver, _depositAmount);
        emit depositLendEvent(_receiver, _shareAmmount);
    }

    event marginTradeEvent(
        address indexed trader,
        address indexed loanToken,
        uint256 newPrinicipal,
        uint256 newCollateral
    );

    function marginTrading(
        address _loanTokenContract,
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
                    _loanTokenContract,
                    collateralTokenSent
                ),
                "Not enough tokens to approve"
            );
        if (loanTokenSent != 0) {
            address loanTokenAddress =
                ILoanTokenLogicStandard(_loanTokenContract).loanTokenAddress();
            require(
                doTransferFrom(
                    loanTokenAddress,
                    _loanTokenContract,
                    loanTokenSent
                ),
                "not enough tokens to approve"
            );
        }
        (newPrinicipal, newCollateral) = ILoanTokenLogicStandard(
            _loanTokenContract
        )
            .marginTrade(
            loanId,
            leverageAmount,
            loanTokenSent,
            collateralTokenSent,
            collateralTokenAddress,
            trader,
            loanDataBytes
        );
        emit marginTradeEvent(
            trader,
            _loanTokenContract,
            newPrinicipal,
            newCollateral
        );
    }

    event depositCollateralEvent(
        address indexed receiver,
        uint256 depositAmount
    );

    function depositCollateral(
        address _calledContract,
        address _tokenContract,
        bytes32 loanId,
        uint256 depositAmount
    ) public {
        require(
            doTransferFrom(_tokenContract, _calledContract, depositAmount),
            "Not enough tokens to approve"
        );
        SovrynProtocol(_calledContract).depositCollateral(
            loanId,
            depositAmount
        );
        emit depositCollateralEvent(msg.sender, depositAmount);
    }

    event borrowEvent(
        address indexed receiver,
        uint256 newPrinicipal,
        uint256 newCollateral
    );

    function borrow(
        address _loanTokenContract,
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
                _loanTokenContract,
                collateralTokenSent
            ),
            "Not enough tokens to approve"
        );
        (newPrinicipal, newCollateral) = ILoanTokenLogicStandard(
            _loanTokenContract
        )
            .borrow(
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

    event closeWithDepositEvent(
        address indexed user,
        uint256 loanCloseAmmount,
        uint256 withdrawAmmount,
        address indexed withdrawToken
    );

    function closeWithDeposit(
        address _calledContract,
        address _tokenContract,
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
        // Verify that user is a verified signer
        // VerifyUser(msg.sender,loanId,receiver,depositAmount,sig);
        //NO SIGNATURE REQUIRE HERE because we check here caller of closeWithDeposit is borrower only .
        SovrynProtocol.Loan memory loanLocal =
            SovrynProtocol(_calledContract).loans(loanId);
        require(msg.sender == address(loanLocal.borrower), "unauthorized");
        require(
            doTransferFrom(_tokenContract, _calledContract, depositAmount),
            "Not enough tokens to approve"
        );
        //sovrynProtocol(_calledContract).setDelegatedManager(loanId,address(this),true);
        //   (loanCloseAmount,withdrawAmount,withdrawToken)=SovrynProtocol(_calledContract).closeWithDeposit(loanId,receiver,depositAmount);
        emit closeWithDepositEvent(
            receiver,
            loanCloseAmount,
            withdrawAmount,
            withdrawToken
        );
    }

    event swapExternalEvent(
        address indexed receiver,
        uint256 destTokenAmountReceived,
        uint256 sourceTokenAmountUsed
    );

    function swapExternal(
        address _calledContract,
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        bytes calldata swapData
    )
        public
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        // Not yet Deployed on TestNet
        //changes require in SwapsExternal.sol file in module folder
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
