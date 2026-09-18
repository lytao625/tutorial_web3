// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

// 测试用的假预言机：返回构造时传入的固定价格，
// 用来替代本地模拟链上不存在的真实 Chainlink 数据源。
// latestRoundData() 的签名与 AggregatorV3Interface 保持一致。
contract MockV3Aggregator {
    int256 private immutable price;

    constructor(int256 _price) {
        price = _price;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (0, price, 0, 0, 0);
    }
}
