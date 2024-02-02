pragma solidity 0.5.17;

import "../interfaces/ILoanTokenModules.sol";
import "../interfaces/IERC20.sol";
import "../connectors/loantoken/interfaces/ProtocolLike.sol";
import "../openzeppelin/SafeMath.sol";
import "../interfaces/IWrbtcERC20.sol";
import "./interfaces/IERC1820Registry.sol";
import "../mockup/MockLoanTokenLogic.sol";

/**
 * @dev This is the smart contract wrapper that is designed to test the cross-reentrancy attack between the protocol & loan token contract.
 * The cross-reentrancy can be triggered from the closeWithSwap, closeWithDeposit, liquidate, rollover since it might send the RBTC / ERC777 back to the receiver for refunding the excess of the swap.
 * This wrapper function will try to:
 * 1. Borrow some ERC777 from the lending pool.
 * 2. Close the loan with closeWithDeposit function in the protocol.
 * 3. Burn all iERC777.
 *
 * The cross-reentrancy happened in step#3. It might happened through a hook function (tokensToSend) that is implemented in this contract to support the ERC777 transfer.
 * Inside the hook function, it will try to mint the iERC777.
 * The details about the hook functions can be found here: https://eips.ethereum.org/EIPS/eip-777#hooks
 *
 * This function should never been passed in the unit testing since we have:
 * 1. invariant check for the loan token (iToken) total supply for closeWithDeposit function.
 * 2. global reentrancy guard between the protocol & the loan token.
 */

contract TestCrossReentrancyERC777 {
    address public loanToken;
    address public WRBTC;
    address public SUSD; /// ERC777
    ProtocolLike public sovrynProtocol;

    IERC1820Registry internal constant ERC1820_REGISTRY =
        IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

    using SafeMath for uint256;

    struct balanceState {
        uint256 rbtcBalance;
        uint256 wrbtcBalance;
        uint256 susdBalance;
        uint256 iUSDTBalance;
    }

    function() external payable {}

    constructor(
        address _loanToken,
        address _WRBTC,
        address _SUSD,
        address _sovrynProtocol
    ) public {
        loanToken = _loanToken;
        WRBTC = _WRBTC;
        SUSD = _SUSD;
        sovrynProtocol = ProtocolLike(_sovrynProtocol);

        ERC1820_REGISTRY.setInterfaceImplementer(
            address(this),
            keccak256("ERC777TokensSender"),
            address(this)
        );
        ERC1820_REGISTRY.setInterfaceImplementer(
            address(this),
            keccak256("ERC20Token"),
            address(this)
        );
    }

    function testCrossReentrancy(uint256 withdrawAmount, uint256 collateralTokenSent) public {
        address _receiver = address(this);
        address _borrower = address(this);

        // step 1, borrow
        // prerequisite: WRBTC has been transferred to this contract
        balanceState memory initial = balanceState({
            rbtcBalance: address(this).balance,
            wrbtcBalance: IERC20(WRBTC).balanceOf(address(this)),
            susdBalance: IERC20(SUSD).balanceOf(address(this)),
            iUSDTBalance: ILoanTokenModules(loanToken).balanceOf(_borrower)
        });

        IERC20(WRBTC).approve(loanToken, initial.susdBalance);

        ILoanTokenModules(loanToken).borrow(
            bytes32(0),
            withdrawAmount,
            10000,
            collateralTokenSent,
            WRBTC,
            _borrower,
            _receiver,
            ""
        );

        uint256 _borrowerNonce = sovrynProtocol.borrowerNonce(_borrower);
        bytes32 loanParamsLocalId = ILoanTokenModules(loanToken).loanParamsIds(
            uint256(keccak256(abi.encodePacked(WRBTC, true)))
        );
        bytes32 loan_id = keccak256(
            abi.encodePacked(loanParamsLocalId, loanToken, _borrower, _borrowerNonce)
        );

        // STEP 3 close the borrowed position with a deposit
        uint256 _SUSDBalance = IERC20(SUSD).balanceOf(address(this));
        IERC20(SUSD).approve(address(sovrynProtocol), _SUSDBalance);
        sovrynProtocol.closeWithDeposit(
            loan_id,
            address(this),
            collateralTokenSent.mul(20).div(100) // make it 20% higher from initial borrow amount
        );

        /** Rest of code Should not be executed as in there will be reverted in step #3 because of invariant check.
        if it's got executed, means that there is an cross-reentrancy vulnerability */
        // STEP 4 Burn all iSUSD
        uint256 _iSUSDBalance = ILoanTokenModules(loanToken).balanceOf(_borrower);
        ILoanTokenModules(loanToken).burn(_receiver, _iSUSDBalance);

        /** Used for debugging */
        // balanceState memory finalBalance =
        //     balanceState({
        //         rbtcBalance: address(this).balance,
        //         wrbtcBalance: IERC20(WRBTC).balanceOf(address(this)),
        //         susdBalance: IERC20(SUSD).balanceOf(address(this)),
        //         iUSDTBalance: ILoanTokenModules(loanToken).balanceOf(_borrower)
        //     });
    }

    function tokensToSend(
        address operator,
        address from,
        address to,
        uint256,
        bytes calldata,
        bytes calldata
    ) external {
        if (operator == address(sovrynProtocol) && to == loanToken && from == address(this)) {
            uint256 _SUSDBalance = IERC20(SUSD).balanceOf(address(this));
            IERC20(SUSD).approve(loanToken, _SUSDBalance);

            ILoanTokenModules(loanToken).mint(address(this), 1000000 ether); // unable to reentrant mint here since mint function have reentrancy guard in place
        }
    }
}
