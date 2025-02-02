/* eslint-disable import/no-unused-modules */
import { buildModule } from "@nomicfoundation/ignition-core";
import { assert } from "chai";

import {
  TestChainHelper,
  useFileIgnitionProject,
} from "../use-ignition-project";

import { mineBlock } from "./helpers";

/**
 * Run an initial deploy, that deploys a contract. The module is modified
 * to add an additional dependent contract. On the second run only one contract
 * is deployed.
 */
describe("execution - rerun with new contract deploy", () => {
  useFileIgnitionProject("minimal", "rerun-with-new-contract-deploy");

  it("should deploy only one contract on second run", async function () {
    const moduleDefinition = buildModule("BarModule", (m) => {
      const bar = m.contract("Bar");

      return {
        bar,
      };
    });

    // Start the deploy
    const { bar: originalBar } = await this.runControlledDeploy(
      moduleDefinition,
      async (c: TestChainHelper) => {
        // this block shound include deployment of foo1
        await c.mineBlock(1);
      }
    );

    const firstRunBarAddress = (await originalBar.getAddress()).toLowerCase();

    // Further blocks with no pending transactions
    await mineBlock(this.hre);
    await mineBlock(this.hre);

    const updatedModuleDefinition = buildModule("BarModule", (m) => {
      const bar = m.contract("Bar");
      const usesContract = m.contract("UsesContract", [bar]);

      return {
        bar,
        usesContract,
      };
    });

    // Rerun the deployment
    const result = await this.runControlledDeploy(
      updatedModuleDefinition,
      async (c: TestChainHelper) => {
        // this block shound include deployment of foo2
        await c.mineBlock(1);
      }
    );

    const usedAddress = (
      await result.usesContract.contractAddress()
    ).toLowerCase();

    const secondRunBarAddress = (await result.bar.getAddress()).toLowerCase();

    // The BarModule#Bar contract has not been redeployed if
    // it shares the same address.
    assert.equal(firstRunBarAddress, secondRunBarAddress);
    assert.equal(usedAddress, secondRunBarAddress);
  });
});
