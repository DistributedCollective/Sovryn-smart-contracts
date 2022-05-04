pragma solidity 0.5.17;

import "./IRewardTransferLogic.sol";
import "../utils/AdminRole.sol";
import "../interfaces/IERC20.sol";

contract ERC20TransferLogicStorage is IRewardTransferLogic, AdminRole {
    IERC20 public token;
}
