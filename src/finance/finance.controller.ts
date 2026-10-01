import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller()
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN, UserRole.DISPATCHER)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('fleet-costs/summary')
  @ApiOperation({ summary: 'Summarize fleet operating costs' })
  async getFleetCostSummary(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const data = await this.financeService.getCostSummary(query, user.id);
    return { ok: true, data };
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List fleet cost accounts' })
  async getAccounts(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const result = await this.financeService.getAccounts(query, user.id);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Post('accounts')
  async createAccount(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    const data = await this.financeService.createAccount(payload, user.id);
    return { ok: true, data };
  }

  @Put('accounts/:id')
  async updateAccount(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() payload: any) {
    const data = await this.financeService.updateAccount(id, payload, user.id);
    return { ok: true, data };
  }

  @Delete('accounts/:id')
  async deleteAccount(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.financeService.deleteAccount(id, user.id);
    return { ok: true };
  }

  @Post('accounts/transfer')
  async transferMoney(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    return this.financeService.transferMoney(payload, user.id);
  }

  @Get('categories')
  async getCategories(@Query() query: any) {
    const result = await this.financeService.getCategories(query);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Post('categories')
  async createCategory(@Body() payload: any) {
    const data = await this.financeService.createCategory(payload);
    return { ok: true, data };
  }

  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() payload: any) {
    const data = await this.financeService.updateCategory(id, payload);
    return { ok: true, data };
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    await this.financeService.deleteCategory(id);
    return { ok: true };
  }

  @Get('transactions')
  async getTransactions(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const result = await this.financeService.getTransactions(query, user.id);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('transactions/:id')
  async getTransaction(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.financeService.getTransaction(id, user.id);
    return { ok: true, data };
  }

  @Post('transactions')
  async createTransaction(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    const data = await this.financeService.createTransaction(payload, user.id);
    return { ok: true, data };
  }

  @Put('transactions/:id')
  async updateTransaction(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() payload: any) {
    const data = await this.financeService.updateTransaction(id, payload, user.id);
    return { ok: true, data };
  }

  @Delete('transactions/:id')
  async deleteTransaction(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.financeService.deleteTransaction(id, user.id);
    return { ok: true };
  }

  @Get('budgets')
  async getBudgets(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const result = await this.financeService.getBudgets(query, user.id);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('budgets/:id')
  async getBudget(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.financeService.getBudget(id, user.id);
    return { ok: true, data };
  }

  @Post('budgets')
  async createBudget(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    const data = await this.financeService.createBudget(payload, user.id);
    return { ok: true, data };
  }

  @Put('budgets/:id')
  async updateBudget(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() payload: any) {
    const data = await this.financeService.updateBudget(id, payload, user.id);
    return { ok: true, data };
  }

  @Delete('budgets/:id')
  async deleteBudget(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.financeService.deleteBudget(id, user.id);
    return { ok: true };
  }

  @Get('goals')
  async getGoals(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const result = await this.financeService.getGoals(query, user.id);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('goals/:id')
  async getGoal(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.financeService.getGoal(id, user.id);
    return { ok: true, data };
  }

  @Post('goals')
  async createGoal(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    const data = await this.financeService.createGoal(payload, user.id);
    return { ok: true, data };
  }

  @Put('goals/:id')
  async updateGoal(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() payload: any) {
    const data = await this.financeService.updateGoal(id, payload, user.id);
    return { ok: true, data };
  }

  @Delete('goals/:id')
  async deleteGoal(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.financeService.deleteGoal(id, user.id);
    return { ok: true };
  }

  @Get('recurring')
  async getRecurring(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const result = await this.financeService.getRecurring(query, user.id);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('recurring/:id')
  async getRecurringOne(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.financeService.getRecurringOne(id, user.id);
    return { ok: true, data };
  }

  @Post('recurring')
  async createRecurring(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    const data = await this.financeService.createRecurring(payload, user.id);
    return { ok: true, data };
  }

  @Put('recurring/:id')
  async updateRecurring(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() payload: any) {
    const data = await this.financeService.updateRecurring(id, payload, user.id);
    return { ok: true, data };
  }

  @Delete('recurring/:id')
  async deleteRecurring(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.financeService.deleteRecurring(id, user.id);
    return { ok: true };
  }
}
