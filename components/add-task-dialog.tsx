"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createBrowserClient } from "@/lib/supabase/client"
import { MapPin } from "lucide-react"

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskCreated: () => void
}

interface Employee {
  id: string
  name: string
  email: string
  phone: string
}

interface Location {
  id: string
  name: string
  latitude: number
  longitude: number
}

export function AddTaskDialog({ open, onOpenChange, onTaskCreated }: AddTaskDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState("")
  const [locationName, setLocationName] = useState("")
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [coordinates, setCoordinates] = useState("")
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    if (open) {
      fetchEmployees()
      fetchLocations()
    }
  }, [open])

  async function fetchEmployees() {
    const { data, error } = await supabase.from("employees").select("*").eq("is_active", true).order("name")

    if (!error && data) {
      setEmployees(data)
    }
  }

  async function fetchLocations() {
    const { data, error } = await supabase.from("locations").select("*").eq("is_active", true).order("name")

    if (!error && data) {
      setLocations(data)
    }
  }

  function handleLocationSelect(locationId: string) {
    setSelectedLocationId(locationId)
    const location = locations.find((l) => l.id === locationId)
    if (location) {
      setLocationName(location.name)
      setCoordinates(`${location.latitude},${location.longitude}`)
    }
  }

  function toggleEmployee(employeeId: string) {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId],
    )
  }

  async function handleSubmit() {
    if (!title || selectedEmployees.length === 0) {
      alert("Please complete the title and assign at least one employee")
      return
    }

    setIsSubmitting(true)

    try {
      // Parse coordinates
      let latitude = null
      let longitude = null
      if (coordinates) {
        const [lat, lng] = coordinates.split(",").map((s) => Number.parseFloat(s.trim()))
        if (!isNaN(lat) && !isNaN(lng)) {
          latitude = lat
          longitude = lng
        }
      }

      // Create task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title,
          description,
          priority,
          status: "nueva",
          due_date: dueDate || null,
          location_name: locationName,
          location_id: selectedLocationId || null,
          latitude,
          longitude,
        })
        .select()
        .single()

      if (taskError) throw taskError

      // Create assignments
      const assignments = selectedEmployees.map((employeeId) => ({
        task_id: task.id,
        employee_id: employeeId,
      }))

      const { error: assignmentError } = await supabase.from("task_assignments").insert(assignments)

      if (assignmentError) throw assignmentError

      // Send WhatsApp notifications
      await sendWhatsAppNotifications(task.id, selectedEmployees)

      // Reset form
      setTitle("")
      setDescription("")
      setPriority("medium")
      setDueDate("")
      setLocationName("")
      setSelectedLocationId("")
      setCoordinates("")
      setSelectedEmployees([])

      onTaskCreated()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error creating task:", error)
      alert("Error creating task")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function sendWhatsAppNotifications(taskId: string, employeeIds: string[]) {
    try {
      // Get employee details
      const employeesData = employees.filter((e) => employeeIds.includes(e.id))

      for (const employee of employeesData) {
        if (employee.phone) {
          const message = `Hello ${employee.name}, you have been assigned a new task: "${title}". Priority: ${priority.toUpperCase()}. ${dueDate ? `Due date: ${dueDate}` : ""}`

          // Get WhatsApp Web URL
          const response = await fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: employee.phone,
              message,
            }),
          })

          const data = await response.json()

          if (data.success && data.whatsappUrl) {
            // Open WhatsApp Web in new window
            window.open(data.whatsappUrl, "_blank")

            // Mark as notified
            await supabase
              .from("task_assignments")
              .update({
                notified_via_whatsapp: true,
                whatsapp_sent_at: new Date().toISOString(),
              })
              .eq("task_id", taskId)
              .eq("employee_id", employee.id)
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error sending WhatsApp notifications:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <p className="text-sm text-muted-foreground">Create a task and link it to a map location</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g.: Call to quote Campo Cholchol"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Task details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Low</SelectItem>
                  <SelectItem value="media">Medium</SelectItem>
                  <SelectItem value="alta">High</SelectItem>
                  <SelectItem value="urgente">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Select value={selectedLocationId} onValueChange={handleLocationSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {location.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLocationId && (
            <>
              <div>
                <Label>Location Name</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g.: Campo Cholchol, Lot 45"
                />
              </div>

              <div>
                <Label>Coordinates (lat,lng)</Label>
                <Input value={coordinates} onChange={(e) => setCoordinates(e.target.value)} placeholder="-38.5,-72.3" />
              </div>
            </>
          )}

          <div>
            <Label className="mb-3 block">Assign to Users *</Label>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={employee.id}
                    checked={selectedEmployees.includes(employee.id)}
                    onCheckedChange={() => toggleEmployee(employee.id)}
                  />
                  <label htmlFor={employee.id} className="text-sm cursor-pointer flex-1">
                    {employee.name} ({employee.email})
                  </label>
                </div>
              ))}
            </div>
            {selectedEmployees.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">{selectedEmployees.length} user(s) selected</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
