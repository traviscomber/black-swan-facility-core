"use server"

import { AIAgentService } from "@/lib/ai/agent-service"
import { revalidatePath } from "next/cache"

export async function executeAgent(agentId: string) {
  await AIAgentService.executeAgent(agentId)
  revalidatePath("/ai-ops")
}
