import { BaseModelDto } from '@adocasts.com/dto/base'
import CreditTransaction from '#credits/models/credit_transactions'

export default class CreditTransactionDto extends BaseModelDto {
  declare id: number
  declare amount: number
  declare type: string
  declare description: string | null
  declare balanceAfter: number
  declare createdAt: string

  constructor(transaction?: CreditTransaction) {
    super()

    if (!transaction) return

    this.id = transaction.id
    this.amount = transaction.amount
    this.type = transaction.type
    this.description = transaction.description
    this.balanceAfter = transaction.balanceAfter
    this.createdAt = transaction.createdAt.toISO()!
  }
}
