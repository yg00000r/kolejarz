import { MessageTypeId } from '../constants/komunikaty';

export type QueuedMessage = {
  id: string;
  typeId: MessageTypeId;
  title: string;
  text: string;
};

let _queue: QueuedMessage[] = [];

export function getQueue(): QueuedMessage[] { return _queue; }
export function addToQueue(m: QueuedMessage) { _queue = [..._queue, m]; }
export function removeFromQueue(id: string) { _queue = _queue.filter(m => m.id !== id); }
export function clearQueue() { _queue = []; }
