pragma solidity 0.5.17;

import "../interfaces/ILoanTokenModules.sol";
import "../interfaces/IERC20.sol";
import "../connectors/loantoken/interfaces/ProtocolLike.sol";
import "../openzeppelin/SafeMath.sol";
import "../interfaces/IWrbtcERC20.sol";

contract TestDisc {
    address public loanTokenWRBTC;
    address public WRBTC;
    address public SUSD;
    ProtocolLike public sovrynProtocol;

    using SafeMath for uint256;

    struct balanceState {
        uint256 rbtcBalance;
        uint256 wrbtcBalance;
        uint256 susdBalance;
        uint256 iWRBTCBalance;
    }

    function() external payable {
        if (msg.sender == address(sovrynProtocol)) {
            uint256 latestRBTCBalance = address(this).balance;
            IWrbtcERC20(WRBTC).deposit.value(14 ether)();
            uint256 _WRBTCBalance = IERC20(WRBTC).balanceOf(address(this));
            IERC20(WRBTC).approve(loanTokenWRBTC, _WRBTCBalance);
            ILoanTokenModules(loanTokenWRBTC).mint(address(this), 14 ether); // unable to reentrant mint here since mint function have reentrancy guard in place
        }
    }

    constructor(
        address _loanTokenWRBTC,
        address _WRBTC,
        address _SUSD,
        address _sovrynProtocol
    ) public {
        loanTokenWRBTC = _loanTokenWRBTC;
        WRBTC = _WRBTC;
        SUSD = _SUSD;
        sovrynProtocol = ProtocolLike(_sovrynProtocol);
    }

    function testDisc(uint256 withdrawAmount, uint256 collateralTokenSent) public {
        address _receiver = address(this);
        address _borrower = address(this);

        // step 1, borrow
        // prerequisite: SUSD has been transferred to this contract
        balanceState memory initial =
            balanceState({
                rbtcBalance: address(this).balance,
                wrbtcBalance: IERC20(WRBTC).balanceOf(address(this)),
                susdBalance: IERC20(SUSD).balanceOf(address(this)),
                iWRBTCBalance: ILoanTokenModules(loanTokenWRBTC).balanceOf(_borrower)
            });

        IERC20(SUSD).approve(loanTokenWRBTC, initial.susdBalance);

        ILoanTokenModules(loanTokenWRBTC).borrow(
            bytes32(0),
            withdrawAmount,
            10000,
            collateralTokenSent,
            SUSD,
            _borrower,
            _receiver,
            ""
        );

        // step2 mint 15 iWRBTC
        // prerequisite: this contract should have WRBTC
        uint256 _WRBTCBalance = IERC20(WRBTC).balanceOf(address(this));
        IERC20(WRBTC).approve(loanTokenWRBTC, _WRBTCBalance);
        ILoanTokenModules(loanTokenWRBTC).mint(_receiver, 15 ether);

        uint256 _borrowerNonce = sovrynProtocol.borrowerNonce(_borrower);
        bytes32 loanParamsLocalId =
            ILoanTokenModules(loanTokenWRBTC).loanParamsIds(
                uint256(keccak256(abi.encodePacked(SUSD, true)))
            );
        bytes32 loan_id =
            keccak256(
                abi.encodePacked(loanParamsLocalId, loanTokenWRBTC, _borrower, _borrowerNonce)
            );

        // STEP 3 close the borrowed position with a swap (probably works just as well with deposit)
        sovrynProtocol.closeWithSwap(
            loan_id,
            msg.sender,
            collateralTokenSent.mul(200).div(100), // make it 20% higher from initial collateral sent to make sure whole position is closed
            true,
            ""
        );

        /** Rest of code Should not be executed */
        // STEP 4 Burn all iRBTC
        uint256 _iWRBTCBalance = ILoanTokenModules(loanTokenWRBTC).balanceOf(_borrower);
        ILoanTokenModules(loanTokenWRBTC).burn(_receiver, _iWRBTCBalance);

        balanceState memory finalBalance =
            balanceState({
                rbtcBalance: address(this).balance,
                wrbtcBalance: IERC20(WRBTC).balanceOf(address(this)),
                susdBalance: IERC20(SUSD).balanceOf(address(this)),
                iWRBTCBalance: ILoanTokenModules(loanTokenWRBTC).balanceOf(_borrower)
            });
    }
}
