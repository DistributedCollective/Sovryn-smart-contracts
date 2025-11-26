// SPDX-License-Identifier: MIT
// how to use
// $ forge script script/DeployRootstockUsdtSwap.s.sol:DeployRootstockUsdtSwap --sig "run(address,address,address)" <rusdtReceiver> <usdt0Provider> <rescuer> --broadcast
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import { RootstockUsdtSwap } from "../contracts/utils/RootstockUsdtSwap.sol";

contract DeployRootstockUsdtSwap is Script {
    function run(address rusdtReceiver, address usdt0Provider, address rescuer) external {
        vm.startBroadcast();
        new RootstockUsdtSwap(rusdtReceiver, usdt0Provider, rescuer);
        vm.stopBroadcast();
    }
}
