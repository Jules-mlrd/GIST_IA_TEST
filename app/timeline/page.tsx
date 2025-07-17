"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, AlertCircle, Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react";


export default function TimelinePage() {
  type Milestone = {
    name: string;
    description: string;
    date: string;
    status: 'completed' | 'in-progress' | 'pending';
  };
  type Task = {
    id: string;
    name: string;
    assignee: string;
    startDate: string;
    endDate: string;
    status: 'completed' | 'in-progress' | 'pending';
  };

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/affaires/timeline');
        if (!res.ok) throw new Error("Erreur lors du chargement de la timeline");
        const data = await res.json();
        setMilestones(Array.isArray(data.timeline) ? data.timeline : []);
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } catch (e: any) {
        setError(e.message || "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }
    fetchTimeline();
  }, []);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Mois précédent
          </Button>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Calendar className="h-4 w-4 mr-2" />
            Mars 2024
          </Badge>
          <Button variant="outline" size="sm">
            Mois suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <Button className="bg-sncf-red hover:bg-red-700">
          <Clock className="mr-2 h-4 w-4" />
          Ajouter un événement
        </Button>
      </div>

      <Tabs defaultValue="milestones" className="w-full">
        <TabsList>
          <TabsTrigger value="milestones">Jalons</TabsTrigger>
          <TabsTrigger value="tasks">Tâches</TabsTrigger>
          <TabsTrigger value="gantt">Diagramme de Gantt</TabsTrigger>
        </TabsList>

        <TabsContent value="milestones" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Jalons du projet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                {loading ? (
                  <div className="text-center text-gray-500 py-8">Chargement des jalons...</div>
                ) : error ? (
                  <div className="text-center text-red-500 py-8">{error}</div>
                ) : milestones.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">Aucun jalon trouvé.</div>
                ) : (
                  <div className="space-y-8">
                    {milestones.map((milestone: Milestone, index: number) => (
                      <div key={index} className="relative pl-10">
                        <div className="absolute left-0 top-1.5 flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gray-200">
                          {milestone.status === "completed" && <CheckCircle className="h-5 w-5 text-green-500" />}
                          {milestone.status === "in-progress" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                          {milestone.status === "pending" && <Clock className="h-5 w-5 text-gray-400" />}
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">{milestone.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">{milestone.description}</p>
                          </div>
                          <div className="mt-2 md:mt-0 md:ml-4">
                            <Badge
                              variant={
                                milestone.status === "completed"
                                  ? "outline"
                                  : milestone.status === "in-progress"
                                    ? "default"
                                    : "secondary"
                              }
                              className="whitespace-nowrap"
                            >
                              {milestone.date}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tâches du projet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                  <div className="text-center text-gray-500 py-8">Chargement des tâches...</div>
                ) : error ? (
                  <div className="text-center text-red-500 py-8">{error}</div>
                ) : tasks.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">Aucune tâche trouvée.</div>
                ) : tasks.map((task: Task) => (
                  <div
                    key={task.id}
                    className={`p-4 border rounded-lg ${
                      task.status === "completed"
                        ? "bg-green-50 border-green-200"
                        : task.status === "in-progress"
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">{task.id}</span>
                          <h3 className="font-medium text-gray-900">{task.name}</h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Assigné à: {task.assignee}</p>
                      </div>
                      <Badge
                        variant={
                          task.status === "completed"
                            ? "outline"
                            : task.status === "in-progress"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {task.status === "completed"
                          ? "Terminé"
                          : task.status === "in-progress"
                            ? "En cours"
                            : "À venir"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {task.startDate} - {task.endDate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagramme de Gantt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-80 border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <Calendar className="mx-auto h-10 w-10 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Diagramme de Gantt</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Cette section affichera un diagramme de Gantt interactif pour visualiser la planification du projet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
