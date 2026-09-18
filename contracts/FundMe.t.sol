//SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {FundMe} from "./FundMe.sol";
import {MockV3Aggregator} from "@chainlink/contracts/src/v0.8/shared/mocks/MockV3Aggregator.sol";
import {Test} from "forge-std/Test.sol";


contract FundMeTest is Test {
    FundMe fundMe;

    function setUp() public {
        // 假预言机返回 1 ETH = 3000 USD（Chainlink 价格是 8 位小数）
        MockV3Aggregator mock = new MockV3Aggregator(8, 3000 * 10 ** 8);
        fundMe = new FundMe(address(mock), 300);
    }

    function test_fund() public {
        uint256 amount = 1 ether;
        fundMe.fund{value: amount}();
        assertEq(fundMe.fundersToAmount(address(this)), amount);
    }
}