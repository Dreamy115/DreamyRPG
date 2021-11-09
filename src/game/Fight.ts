export class Fight {
  $: {
    _id: string
    queue: string[]
    parties: string[][]
  }
  
  constructor(data: Fight["$"]) {
    this.$ = data;
  }
}