"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, Clock, Calendar, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartContainer } from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import AffaireLayout from "@/components/AffaireLayout";

export default function TimelineAffairePage() {
  const params = useParams();
  const router = useRouter();
  const affaire = params?.numero_affaire || "";
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [gantt, setGantt] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTimeline(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/affaires/${affaire}/timeline${refresh ? "?refresh=1" : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erreur lors du chargement de la timeline");
      const data = await res.json();
      setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setGantt(Array.isArray(data.gantt) ? data.gantt : []);
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (affaire) fetchTimeline();
  }, [affaire]);

  // Bouton Rafraîchir harmonisé (identique à la synthèse)
  const refreshButton = (
    <Button
      variant="outline"
      className="flex items-center gap-2 border-purple-700 text-purple-700 hover:bg-purple-100/10 hover:text-purple-700 hover:border-purple-700 transition"
      onClick={() => { setRefreshing(true); fetchTimeline(true); }}
      disabled={refreshing || loading}
      title="Rafraîchir la timeline IA"
    >
      {refreshing ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
      Rafraîchir
    </Button>
  );

  return (
    <AffaireLayout numero_affaire={affaire} active="timeline">
      <h1 className="text-2xl font-bold text-purple-800 mb-6 text-center">Timeline de l'affaire {affaire && <span className="text-gray-500 font-normal ml-2">{affaire}</span>}</h1>
      <div className="flex justify-end mb-4">{refreshButton}</div>
      {loading ? (
        <div className="text-center text-gray-500 py-10">Chargement de la timeline IA...</div>
      ) : error ? (
        <div className="text-center text-red-500 py-10">{error}</div>
      ) : (
        <Tabs defaultValue="milestones" className="w-full">
          <TabsList>
            <TabsTrigger value="milestones">Jalons IA</TabsTrigger>
            <TabsTrigger value="tasks">Tâches IA</TabsTrigger>
            <TabsTrigger value="gantt">Diagramme de Gantt IA</TabsTrigger>
          </TabsList>
          <TabsContent value="milestones" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Jalons extraits par l'IA</CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">Aucun jalon détecté pour cette affaire.</div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                    <div className="space-y-8">
                      {timeline.map((milestone, index) => (
                        <div key={index} className="relative pl-10">
                          <div className="absolute left-0 top-1.5 flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gray-200">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">{milestone.label}</h3>
                              {milestone.description && <p className="text-sm text-gray-500 mt-1">{milestone.description}</p>}
                            </div>
                            <div className="mt-2 md:mt-0 md:ml-4">
                              <Badge variant="outline" className="whitespace-nowrap">{milestone.date}</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tâches extraites par l'IA</CardTitle>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">Aucune tâche détectée pour cette affaire.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task, idx) => (
                      <div key={task.id || idx} className={`p-4 border rounded-lg ${
                        task.status === "completed"
                          ? "bg-green-50 border-green-200"
                          : task.status === "in-progress"
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-gray-50 border-gray-200"
                      }`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500">{task.id}</span>
                              <h3 className="font-medium text-gray-900">{task.name}</h3>
                            </div>
                            {task.assignee && <p className="text-sm text-gray-500 mt-1">Assigné à: {task.assignee}</p>}
                            {task.description && <p className="text-xs text-gray-400 mt-1">{task.description}</p>}
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
                            {task.startDate || "?"} - {task.endDate || "?"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="gantt" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Diagramme de Gantt IA</CardTitle>
              </CardHeader>
              <CardContent>
                {gantt.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">Aucun élément de Gantt détecté pour cette affaire.</div>
                ) : (
                  <div className="w-full h-[400px]">
                    <ChartContainer config={{ completed: { color: '#22c55e' }, inprogress: { color: '#eab308' }, pending: { color: '#a3a3a3' } }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={gantt.map((item, idx) => {
                            // Convertir les dates en timestamp (ou index si manquant)
                            const start = item.startDate ? new Date(item.startDate).getTime() : idx * 86400000;
                            const end = item.endDate ? new Date(item.endDate).getTime() : start + 86400000;
                            return {
                              ...item,
                              yLabel: item.label,
                              start,
                              end,
                              duration: end - start > 0 ? end - start : 86400000,
                              statusKey: item.status === 'completed' ? 'completed' : item.status === 'in-progress' ? 'inprogress' : 'pending',
                            };
                          })}
                          margin={{ left: 60, right: 20, top: 20, bottom: 20 }}
                        >
                          <XAxis
                            type="number"
                            dataKey="start"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={v => {
                              const d = new Date(v);
                              return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
                            }}
                            label={{ value: 'Date', position: 'insideBottom', offset: -10 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="yLabel"
                            width={120}
                            tick={{ fontSize: 12 }}
                          />
                          <RechartsTooltip
                            formatter={(_, __, props) => {
                              const { payload } = props;
                              if (!payload) return null;
                              const start = new Date(payload.start);
                              const end = new Date(payload.end);
                              return [
                                `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`,
                                'Période',
                              ];
                            }}
                          />
                          <Bar
                            dataKey="duration"
                            minPointSize={5}
                            isAnimationActive={false}
                            background
                            radius={[6, 6, 6, 6]}
                            fill="#8884d8"
                            >
                            <LabelList dataKey="yLabel" position="insideLeft" style={{ fill: '#fff', fontWeight: 600 }} />
                            {gantt.map((item, idx) => (
                              <Cell
                                key={`cell-${idx}`}
                                fill={item.status === 'completed' ? '#22c55e' : item.status === 'in-progress' ? '#eab308' : '#a3a3a3'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AffaireLayout>
  );
} 