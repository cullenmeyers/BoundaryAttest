import { latestReceiptHash, sortedReceipts } from "./chain.js";
import { createSignedReceipt, listReceiptPaths, writeReceipt, type CreateReceiptOptions, type Receipt } from "./receipts.js";

export type AgentReceipt = Receipt;

export type ReceiptSinkResult = {
  receiptPath?: string | null;
  receiptId?: string | null;
  sinkName: string;
};

export type ReceiptSink = {
  name: string;
  write(receipt: AgentReceipt): Promise<ReceiptSinkResult>;
};

export type LocalFileReceiptWriteResult = {
  receipt: AgentReceipt;
  sinkResult: ReceiptSinkResult;
};

let localFileWriteQueue: Promise<void> = Promise.resolve();

function enqueueLocalFileWrite<T>(task: () => T | Promise<T>): Promise<T> {
  const run = localFileWriteQueue.then(task, task);
  localFileWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export class LocalFileReceiptSink implements ReceiptSink {
  readonly name = "local-file";

  async write(receipt: AgentReceipt): Promise<ReceiptSinkResult> {
    return enqueueLocalFileWrite(() => this.writeImmediate(receipt));
  }

  async createAndWriteReceipt(
    options: Omit<CreateReceiptOptions, "previousReceiptHash">,
  ): Promise<LocalFileReceiptWriteResult> {
    return enqueueLocalFileWrite(() => {
      const previousReceiptHash = latestReceiptHash(sortedReceipts(listReceiptPaths()));
      const receipt = createSignedReceipt({ ...options, previousReceiptHash });
      const sinkResult = this.writeImmediate(receipt);
      return { receipt, sinkResult };
    });
  }

  private writeImmediate(receipt: AgentReceipt): ReceiptSinkResult {
    const receiptPath = writeReceipt(receipt);
    return {
      receiptPath,
      receiptId: receipt.receipt_id,
      sinkName: this.name,
    };
  }
}

export class ConsoleReceiptSink implements ReceiptSink {
  readonly name = "console";

  async write(receipt: AgentReceipt): Promise<ReceiptSinkResult> {
    console.log(
      `Receipt ${receipt.receipt_id} | tool ${receipt.tool} | status ${receipt.action_status} | sink ${this.name}`,
    );
    return {
      receiptPath: null,
      receiptId: receipt.receipt_id,
      sinkName: this.name,
    };
  }
}

export class MemoryReceiptSink implements ReceiptSink {
  readonly name = "memory";
  readonly receipts: AgentReceipt[] = [];

  async write(receipt: AgentReceipt): Promise<ReceiptSinkResult> {
    this.receipts.push(receipt);
    return {
      receiptPath: null,
      receiptId: receipt.receipt_id,
      sinkName: this.name,
    };
  }
}
