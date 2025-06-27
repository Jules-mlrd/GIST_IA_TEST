"use client"

import { useState, useEffect, useRef } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Download, BarChart3, FileText, HelpCircle, RefreshCw } from "lucide-react"
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartData, PointElement, LineElement, ArcElement } from "chart.js"
import { Bar, Line, Pie } from "react-chartjs-2"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { X, Plus } from "lucide-react"

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, PointElement, LineElement, ArcElement)

interface S3Document {
  name: string
  key: string
  size: string
  lastModified: string
  type: string
  url: string
}

const WIDGET_TYPES = [
  { value: "global", label: "Synthèse globale IA", color: "blue" },
  { value: "devis", label: "Synthèse devis IA", color: "pink" },
  { value: "excel", label: "Analyse Excel/CSV", color: "green" },
  { value: "pdf", label: "Analyse PDF", color: "purple" },
  { value: "txt", label: "Analyse TXT", color: "yellow" },
]

function getWidgetColor(type: string) {
  return WIDGET_TYPES.find(w => w.value === type)?.color || "gray"
}

function getWidgetLabel(type: string) {
  return WIDGET_TYPES.find(w => w.value === type)?.label || type
}

function getWidgetIcon(type: string) {
  if (type === "global" || type === "excel") return <BarChart3 className="h-5 w-5" />
  return <FileText className="h-5 w-5" />
}

const initialWidgets = [
  { id: 1, type: "global" },
  { id: 2, type: "devis" },
  { id: 3, type: "excel" },
  { id: 4, type: "pdf" },
  { id: 5, type: "txt" },
]

// Hook personnalisé pour la gestion des widgets et de leur état
function useWidgetState(initialWidgets: { id: number, type: string }[] = []) {
  const [widgets, setWidgets] = useState<{ id: number, type: string }[]>(initialWidgets)
  const [nextWidgetId, setNextWidgetId] = useState(initialWidgets.length + 1)
  const [selections, setSelections] = useState<Record<number, string[]>>({})
  const [results, setResults] = useState<Record<number, any>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string | null>>({})

  const addWidget = (type: string) => {
    setWidgets(w => [...w, { id: nextWidgetId, type }])
    setNextWidgetId(id => id + 1)
  }
  const removeWidget = (id: number) => {
    setWidgets(w => w.filter(wi => wi.id !== id))
    setSelections(s => { const c = { ...s }; delete c[id]; return c })
    setResults(r => { const c = { ...r }; delete c[id]; return c })
    setLoading(l => { const c = { ...l }; delete c[id]; return c })
    setErrors(e => { const c = { ...e }; delete c[id]; return c })
  }
  const select = (id: number, key: string) => {
    setSelections(sel => {
      const prev = sel[id] || []
      return { ...sel, [id]: prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key] }
    })
  }
  const selectAll = (id: number, docs: S3Document[]) => {
    setSelections(sel => {
      const allKeys = docs.map(doc => doc.key)
      const alreadyAll = (sel[id] || []).length === allKeys.length
      return { ...sel, [id]: alreadyAll ? [] : allKeys }
    })
  }
  const setWidgetResult = (id: number, result: any) => setResults(r => ({ ...r, [id]: result }))
  const setWidgetLoading = (id: number, value: boolean) => setLoading(l => ({ ...l, [id]: value }))
  const setWidgetError = (id: number, value: string | null) => setErrors(e => ({ ...e, [id]: value }))

  return {
    widgets,
    addWidget,
    removeWidget,
    selections,
    select,
    selectAll,
    results,
    setWidgetResult,
    loading,
    setWidgetLoading,
    errors,
    setWidgetError,
  }
}

// Composant utilitaire pour un graphique avec export PNG
function ChartWithExport({ chartType, chartData, chartOptions, title, explanation, axes, children }: {
  chartType: 'bar' | 'line' | 'pie',
  chartData: any,
  chartOptions: any,
  title: string,
  explanation?: string,
  axes?: string,
  children?: React.ReactNode
}) {
  const chartRef = useRef<any>(null);
  const handleExportPNG = () => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'graphique'}.png`;
      a.click();
    }
  };
  let ChartComponent = null;
  if (chartType === 'bar') ChartComponent = <Bar ref={chartRef} data={chartData} options={chartOptions} />;
  else if (chartType === 'line') ChartComponent = <Line ref={chartRef} data={chartData} options={chartOptions} />;
  else if (chartType === 'pie') {
    // Robustesse Pie chart
    const labels = Array.isArray(chartData.labels) ? chartData.labels.filter((l: string) => l !== null && l !== undefined && l !== "") : [];
    const dataArr = Array.isArray(chartData.datasets?.[0]?.data) ? chartData.datasets[0].data.map((v: number) => (typeof v === 'number' && !isNaN(v) ? v : 0)) : [];
    // Debug affichage
    const debug = true;
    if (debug) {
      ChartComponent = <div className="mb-2 text-xs text-gray-500">Labels: {JSON.stringify(labels)}<br/>Data: {JSON.stringify(dataArr)}</div>;
    }
    if (labels.length === 0 || dataArr.length === 0 || dataArr.every((v: number) => v === 0)) {
      ChartComponent = <div className="text-yellow-700 font-semibold">Impossible d'afficher le camembert : données vides ou non valides.</div>;
    } else if (labels.length === 1) {
      ChartComponent = <div className="text-yellow-700 font-semibold">Impossible d'afficher un camembert avec une seule valeur.</div>;
    } else {
      ChartComponent = <Pie ref={chartRef} data={{
        ...chartData,
        labels,
        datasets: [{ ...chartData.datasets[0], data: dataArr }],
      }} options={chartOptions} />;
    }
  }
  return (
    <div className="mb-4 p-3 bg-white border border-green-100 rounded-lg shadow-sm">
      <div className="font-semibold text-green-800 mb-1 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-green-400" /> {title}
      </div>
      {ChartComponent}
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={handleExportPNG}>
          <Download className="h-4 w-4 mr-1" /> Exporter en PNG
        </Button>
        {children}
      </div>
      {explanation && (
        <div className="text-xs text-gray-700 mt-2 italic">{explanation}</div>
      )}
      {axes && <div className="text-xs text-gray-500 mt-1">{axes}</div>}
    </div>
  );
}

// Sous-composant pour un widget d'analyse
function WidgetCard({
  widget,
  color,
  label,
  icon,
  docs,
  sel,
  res,
  isLoading,
  error,
  onRemove,
  onSelect,
  onSelectAll,
  onAnalyze,
  onDownloadSummary,
  getChartData
}: {
  widget: { id: number, type: string },
  color: string,
  label: string,
  icon: React.ReactNode,
  docs: S3Document[],
  sel: string[],
  res: any,
  isLoading: boolean,
  error: string | null,
  onRemove: (id: number) => void,
  onSelect: (id: number, key: string) => void,
  onSelectAll: (id: number, docs: S3Document[]) => void,
  onAnalyze: (id: number, type: string) => void,
  onDownloadSummary: (id: number) => void,
  getChartData: (res: any) => ChartData<'bar', any, unknown> | undefined
}) {
  // Pour Excel : mémoriser l'index du graphique sélectionné pour chaque item (fichier)
  const [selectedChartIdxs, setSelectedChartIdxs] = useState<Record<number, number>>({});

  let chartComponent = null;
  let labels: string[] = [];
  let values: number[] = [];
  let pieLabels: string[] = [];
  let pieData: number[] = [];
  if (res && res.data && res.data.length > 0) {
    labels = res.data.slice(0, 20).map((row: any) => row[res.data[0][0]]);
    values = res.data.slice(0, 20).map((row: any) => parseFloat(row[res.data[0][1]]) || 0);
    if (res.type.toLowerCase() === "pie" || res.type.toLowerCase() === "camembert") {
      const group: Record<string, number> = {};
      res.data.slice(0, 100).forEach((row: any) => {
        const key = row[res.data[0][0]];
        const val = parseFloat(row[res.data[0][1]]) || 1;
        group[key] = (group[key] || 0) + val;
      });
      pieLabels = Object.keys(group);
      pieData = Object.values(group);
    }
    if (res.type.toLowerCase() === "bar" || res.type.toLowerCase() === "column" || res.type.toLowerCase() === "histogram") {
      chartComponent = (
        <ChartWithExport
          chartType="bar"
          chartData={{
            labels,
            datasets: [
              {
                label: res.data[0][1],
                data: values,
                backgroundColor: '#22c55e',
              },
            ],
          }}
          chartOptions={{ responsive: true, plugins: { legend: { display: false } } }}
          title={`${res.title} (${res.type})`}
          explanation={res.explanation}
          axes={`Axe X : ${res.data[0][0]} | Axe Y : ${res.data[0][1]}`}
        />
      );
    } else if (res.type.toLowerCase() === "line" || res.type.toLowerCase() === "courbe") {
      chartComponent = (
        <ChartWithExport
          chartType="line"
          chartData={{
            labels,
            datasets: [
              {
                label: res.data[0][1],
                data: values,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34,197,94,0.2)'
              },
            ],
          }}
          chartOptions={{ responsive: true, plugins: { legend: { display: false } } }}
          title={`${res.title} (${res.type})`}
          explanation={res.explanation}
          axes={`Axe X : ${res.data[0][0]} | Axe Y : ${res.data[0][1]}`}
        />
      );
    } else if (res.type.toLowerCase() === "pie" || res.type.toLowerCase() === "camembert") {
      chartComponent = (
        <ChartWithExport
          chartType="pie"
          chartData={{
            labels: pieLabels,
            datasets: [
              {
                label: res.data[0][1],
                data: pieData,
                backgroundColor: [
                  '#22c55e', '#a3e635', '#fde047', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#f472b6', '#facc15', '#34d399', '#818cf8', '#f472b6', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#f472b6', '#facc15', '#34d399', '#818cf8'
                ],
              },
            ],
          }}
          chartOptions={{ responsive: true, plugins: { legend: { display: true, position: 'bottom' } } }}
          title={`${res.title} (${res.type})`}
          explanation={res.explanation}
          axes={`Axe X : ${res.data[0][0]} | Axe Y : ${res.data[0][1]}`}
        />
      );
    } else {
      chartComponent = (
        <div className="text-yellow-700 flex items-center gap-2"><FileText className="h-4 w-4" /> Type de graphique non supporté : {res.type}</div>
      );
    }
  }

  return (
    <Card className={`bg-white/90 shadow-md rounded-xl border border-gray-100 transition p-0 flex flex-col min-h-[420px] w-full`}>
      <CardHeader className="flex flex-row items-center gap-3 pb-1 px-6 pt-6">
        {icon}
        <CardTitle className={`text-lg font-bold text-${color}-800`}>{label}</CardTitle>
        <Button size="icon" variant="ghost" className="ml-auto" onClick={() => onRemove(widget.id)}><X className="h-5 w-5" /></Button>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-1 flex-1 flex flex-col">
        <div className="mb-3 text-base text-gray-700 font-medium flex items-center justify-between">
          <span>Fichiers à analyser :</span>
          <Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm" onClick={() => onSelectAll(widget.id, docs)}>
            {sel.length === docs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
          </Button>
        </div>
        <div className={`max-h-40 overflow-y-auto rounded border bg-${color}-50/40 p-2 mb-5`}>
          {docs.length === 0 && <div className="text-gray-400 text-sm">Aucun fichier détecté.</div>}
          {docs.map((doc) => (
            <label key={doc.key} className={`flex items-center gap-3 py-2 px-4 rounded cursor-pointer transition hover:bg-${color}-100 ${sel.includes(doc.key) ? `bg-${color}-200/60` : ''} text-base`}>
              <input
                type="checkbox"
                checked={sel.includes(doc.key)}
                onChange={() => onSelect(widget.id, doc.key)}
                className={`accent-${color}-600 w-5 h-5`}
              />
              <span className="font-medium text-gray-900 text-sm">{doc.name}</span>
              <Badge variant="outline" className={`ml-2 text-xs border-${color}-200 text-${color}-700 bg-${color}-50`}>{doc.type.toUpperCase()}</Badge>
              <span className="text-xs text-gray-500">{doc.size}</span>
            </label>
          ))}
        </div>
        {sel.length > 0 && (
          <Button onClick={() => onAnalyze(widget.id, widget.type)} disabled={isLoading} className="w-full h-10 text-base font-semibold flex items-center justify-center">
            {isLoading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
            {isLoading ? <span>Analyse en cours...</span> : 'Analyser'}
          </Button>
        )}
        {isLoading && (
          <div className="w-full h-1.5 bg-gray-200 rounded mt-3 overflow-hidden">
            <div className={`h-1.5 bg-${color}-500 animate-pulse transition-all`} style={{ width: '100%' }} />
          </div>
        )}
        {error && <div className="text-red-600 mt-3 text-base font-semibold">{error}</div>}
        {/* Résultats selon le type de widget */}
        {widget.type === "global" && res && res.detailedSummary && (
          <div className="mt-6 space-y-8">
            <section className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" />Résumé IA détaillé</h3>
              <pre className="whitespace-pre-wrap text-base text-blue-900 leading-relaxed bg-transparent p-0 border-0 max-h-[400px] overflow-auto">{res.detailedSummary}</pre>
              <div className="flex justify-end mt-2">
                <Button variant="outline" size="sm" onClick={() => onDownloadSummary(widget.id)}>
                  <Download className="h-4 w-4 mr-1" /> Télécharger
                </Button>
              </div>
            </section>
            {res.kpis && res.kpis.length > 0 && (
              <section>
                <h4 className="text-blue-900 font-semibold mb-3">Indicateurs clés (KPIs)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {res.kpis.map((kpi: any, idx: number) => (
                    <div key={idx} className="bg-white border border-blue-100 rounded-lg p-4 flex flex-col items-center shadow-sm">
                      <span className="text-blue-700 font-bold text-lg mb-1">{kpi.value}</span>
                      <span className="text-blue-900 text-sm font-medium">{kpi.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {res.alerts && res.alerts.length > 0 && (
              <section>
                <h4 className="text-blue-900 font-semibold mb-3">Alertes / Risques détectés</h4>
                <ul className="list-disc pl-6 text-blue-800">
                  {res.alerts.map((alert: string, idx: number) => (
                    <li key={idx}>{alert}</li>
                  ))}
                </ul>
              </section>
            )}
            {res.people && res.people.length > 0 && (
              <section>
                <h4 className="text-blue-900 font-semibold mb-3">Personnes mentionnées</h4>
                <ul className="list-disc pl-6 text-blue-800">
                  {res.people.map((p: any, idx: number) => (
                    <li key={idx}>{p.name} {p.status && <span className="text-xs text-gray-500">({p.status})</span>} {p.contact && <span className="text-xs text-gray-400">[{p.contact}]</span>}</li>
                  ))}
                </ul>
              </section>
            )}
            {res.timeline && res.timeline.length > 0 && (
              <section>
                <h4 className="text-blue-900 font-semibold mb-3">Timeline</h4>
                <ul className="list-disc pl-6 text-blue-800">
                  {res.timeline.map((t: any, idx: number) => (
                    <li key={idx}>{t.date} : {t.label}</li>
                  ))}
                </ul>
              </section>
            )}
            {getChartData(res) && (
              <section>
                <h4 className="text-blue-900 font-semibold mb-3">KPIs - Graphique</h4>
                <Bar data={getChartData(res)!} options={{ responsive: true, plugins: { legend: { display: false } } }} />
              </section>
            )}
          </div>
        )}
        {/* Rendu pour les autres types de widgets */}
        {widget.type === "excel" && res && (
          <div className="mt-6 space-y-6">
            <h3 className="text-green-900 font-bold text-lg mb-2 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" /> Analyse Excel/CSV
            </h3>
            {Array.isArray(res) && res.length > 0 ? (
              res.map((item: any, idx: number) => {
                const charts = item.charts || [];
                const selectedChartIdx = selectedChartIdxs[idx] || 0;
                const selectedChart = charts[selectedChartIdx];
                // Préparation des données pour chaque type de graphique
                let chartComponent = null;
                let labels: string[] = [];
                let values: number[] = [];
                let pieLabels: string[] = [];
                let pieData: number[] = [];
                if (selectedChart) {
                  labels = item.data.slice(0, 20).map((row: any) => row[selectedChart.x]);
                  values = item.data.slice(0, 20).map((row: any) => parseFloat(row[selectedChart.y]) || 0);
                  if (["pie", "camembert"].includes(selectedChart.type.toLowerCase())) {
                    const group: Record<string, number> = {};
                    item.data.slice(0, 100).forEach((row: any) => {
                      const key = row[selectedChart.x];
                      const val = parseFloat(row[selectedChart.y]) || 1;
                      group[key] = (group[key] || 0) + val;
                    });
                    pieLabels = Object.keys(group);
                    pieData = Object.values(group);
                  }
                  if (["bar", "column", "histogram", "bar chart"].includes(selectedChart.type.toLowerCase())) {
                    chartComponent = (
                      <ChartWithExport
                        chartType="bar"
                        chartData={{
                          labels,
                          datasets: [
                            {
                              label: selectedChart.y,
                              data: values,
                              backgroundColor: '#22c55e',
                            },
                          ],
                        }}
                        chartOptions={{ responsive: true, plugins: { legend: { display: false } } }}
                        title={`${selectedChart.title} (${selectedChart.type})`}
                        explanation={selectedChart.explanation}
                        axes={`Axe X : ${selectedChart.x} | Axe Y : ${selectedChart.y}`}
                      />
                    );
                  } else if (["line", "courbe", "line chart"].includes(selectedChart.type.toLowerCase())) {
                    chartComponent = (
                      <ChartWithExport
                        chartType="line"
                        chartData={{
                          labels,
                          datasets: [
                            {
                              label: selectedChart.y,
                              data: values,
                              borderColor: '#22c55e',
                              backgroundColor: 'rgba(34,197,94,0.2)'
                            },
                          ],
                        }}
                        chartOptions={{ responsive: true, plugins: { legend: { display: false } } }}
                        title={`${selectedChart.title} (${selectedChart.type})`}
                        explanation={selectedChart.explanation}
                        axes={`Axe X : ${selectedChart.x} | Axe Y : ${selectedChart.y}`}
                      />
                    );
                  } else if (["pie", "camembert", "pie chart"].includes(selectedChart.type.toLowerCase())) {
                    chartComponent = (
                      <ChartWithExport
                        chartType="pie"
                        chartData={{
                          labels: pieLabels,
                          datasets: [
                            {
                              label: selectedChart.y,
                              data: pieData,
                              backgroundColor: [
                                '#22c55e', '#a3e635', '#fde047', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#f472b6', '#facc15', '#34d399', '#818cf8', '#f472b6', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#f472b6', '#facc15', '#34d399', '#818cf8'
                              ],
                            },
                          ],
                        }}
                        chartOptions={{ responsive: true, plugins: { legend: { display: true, position: 'bottom' } } }}
                        title={`${selectedChart.title} (${selectedChart.type})`}
                        explanation={selectedChart.explanation}
                        axes={`Axe X : ${selectedChart.x} | Axe Y : ${selectedChart.y}`}
                      />
                    );
                  } else {
                    chartComponent = (
                      <div className="text-yellow-700 flex items-center gap-2"><FileText className="h-4 w-4" /> Type de graphique non supporté : {selectedChart.type}</div>
                    );
                  }
                }
                return (
                  <section key={item.key || idx} className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-green-400" />
                      <span className="font-semibold text-green-900 text-base">{item.key ? item.key.split("/").pop() : `Fichier ${idx+1}`}</span>
                    </div>
                    {item.error ? (
                      <div className="text-red-600 font-semibold">{item.error} {item.details && <span className="text-xs text-gray-500">({item.details})</span>}</div>
                    ) : (
                      <>
                        {item.summary && <div className="mb-2 text-green-900"><span className="font-semibold">Résumé :</span> {item.summary}</div>}
                        {item.keypoints && item.keypoints.length > 0 && (
                          <div className="mb-2">
                            <span className="font-semibold text-green-900">Points clés :</span>
                            <ul className="list-disc pl-6 text-green-800 text-sm">
                              {item.keypoints.map((kp: string, i: number) => <li key={i}>{kp}</li>)}
                            </ul>
                          </div>
                        )}
                        {item.data && Array.isArray(item.data) && item.data.length > 0 && (
                          <div className="mb-2 overflow-x-auto">
                            <span className="font-semibold text-green-900">Aperçu du tableau :</span>
                            <table className="min-w-full border mt-1 text-xs">
                              <thead>
                                <tr>
                                  {Object.keys(item.data[0]).map((col, i) => <th key={i} className="border px-2 py-1 bg-green-100 text-green-900">{col}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {item.data.slice(0, 5).map((row: any, i: number) => (
                                  <tr key={i}>
                                    {Object.values(row).map((val, j) => <td key={j} className="border px-2 py-1">{val !== null && val !== undefined ? val.toString() : ""}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {/* Choix du graphique à afficher */}
                        {charts.length > 0 && (
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-2 mb-2">
                              {charts.map((c: any, i: number) => (
                                <button
                                  key={i}
                                  className={`px-3 py-1 rounded border text-sm font-medium transition ${selectedChartIdx === i ? 'bg-green-600 text-white border-green-700' : 'bg-white text-green-900 border-green-200 hover:bg-green-100'}`}
                                  onClick={() => setSelectedChartIdxs(s => ({ ...s, [idx]: i }))}
                                  type="button"
                                >
                                  {c.title || `Graphique ${i+1}`}
                                </button>
                              ))}
                            </div>
                            {chartComponent}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                );
              })
            ) : (
              <div className="text-gray-500">Aucun résultat d'analyse.</div>
            )}
          </div>
        )}
        {widget.type === "pdf" && res && (
          <div className="mt-6 space-y-4">
            <h3 className="text-purple-900 font-bold text-lg mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" /> Analyse PDF
            </h3>
            {Array.isArray(res) && res.length > 0 ? (
              <ul className="list-disc pl-6 text-purple-800">
                {res.map((item: any, idx: number) => (
                  <li key={idx}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-500">Aucun résultat d'analyse.</div>
            )}
          </div>
        )}
        {widget.type === "txt" && res && (
          <div className="mt-6 space-y-4">
            <h3 className="text-yellow-900 font-bold text-lg mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-yellow-600" /> Analyse TXT
            </h3>
            {Array.isArray(res) && res.length > 0 ? (
              <ul className="list-disc pl-6 text-yellow-800">
                {res.map((item: any, idx: number) => (
                  <li key={idx}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-500">Aucun résultat d'analyse.</div>
            )}
          </div>
        )}
        {widget.type === "devis" && res && (
          <div className="mt-6 space-y-4">
            <h3 className="text-pink-900 font-bold text-lg mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-pink-600" /> Analyse Devis
            </h3>
            {Array.isArray(res) && res.length > 0 ? (
              <ul className="list-disc pl-6 text-pink-800">
                {res.map((item: any, idx: number) => (
                  <li key={idx}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-500">Aucun résultat d'analyse.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Composant modal d'upload de fichiers
function UploadModal({
  show,
  onClose,
  onUpload,
  uploading,
  uploadError,
  uploadSuccess,
  selectedFiles,
  setSelectedFiles,
  dragActive,
  setDragActive,
  fileInputRef
}: {
  show: boolean,
  onClose: () => void,
  onUpload: (e: React.FormEvent<HTMLFormElement>) => void,
  uploading: boolean,
  uploadError: string | null,
  uploadSuccess: boolean,
  selectedFiles: File[],
  setSelectedFiles: (files: File[]) => void,
  dragActive: boolean,
  setDragActive: (active: boolean) => void,
  fileInputRef: React.RefObject<HTMLInputElement | null>
}) {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
        <button className="absolute top-3 right-3" onClick={onClose}><X className="h-6 w-6 text-gray-400" /></button>
        <h2 className="text-xl font-bold mb-4">Téléverser des fichiers</h2>
        <form onSubmit={onUpload} className="flex flex-col gap-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
            onDragEnter={e => { e.preventDefault(); setDragActive(true); }}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
            onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files) setSelectedFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={e => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)) }}
            />
            {selectedFiles.length === 0 ? (
              <span className="text-gray-500">Glissez-déposez des fichiers ici ou cliquez pour sélectionner</span>
            ) : (
              <ul className="text-left text-gray-700 text-sm max-h-32 overflow-y-auto">
                {selectedFiles.map((file, idx) => <li key={idx}>{file.name}</li>)}
              </ul>
            )}
          </div>
          {uploadError && <div className="text-red-600 text-sm font-medium">{uploadError}</div>}
          {uploadSuccess && <div className="text-green-600 text-sm font-medium">Fichiers téléversés avec succès !</div>}
          <div className="flex gap-2 mt-2">
            <Button type="submit" disabled={uploading || selectedFiles.length === 0} className="flex-1">{uploading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}Téléverser</Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AiDashboardPage() {
  const [documents, setDocuments] = useState<S3Document[]>([])
  const {
    widgets,
    addWidget,
    removeWidget,
    selections,
    select,
    selectAll,
    results,
    setWidgetResult,
    loading,
    setWidgetLoading,
    errors,
    setWidgetError,
  } = useWidgetState([])
  const [addType, setAddType] = useState<string>("global")
  // New: upload modal state (placeholder)
  const [showUpload, setShowUpload] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string|null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const fetchDocuments = async () => {
      const res = await fetch("/api/documents")
      const data = await res.json()
      setDocuments(data.documents || [])
    }
    fetchDocuments()
  }, [])

  // New: refresh documents
  const handleRefreshDocs = async () => {
    setWidgetLoading('global' as any, true)
    const res = await fetch("/api/documents")
    const data = await res.json()
    setDocuments(data.documents || [])
    setWidgetLoading('global' as any, false)
  }

  // Analyse par widget
  const handleAnalyze = async (id: number, type: string) => {
    setWidgetLoading(id, true)
    setWidgetError(id, null)
    setWidgetResult(id, null)
    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: selections[id] || [] }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      let result = null
      if (type === "global") result = data.detailedSummary ? data : null
      if (type === "devis") result = data.devisAnalysis || []
      if (type === "excel") result = data.excelAnalysis || []
      if (type === "pdf") result = data.pdfAnalysis || []
      if (type === "txt") result = data.txtAnalysis || []
      setWidgetResult(id, result)
    } catch (err: any) {
      setWidgetError(id, err.message || "Erreur lors de l'analyse")
    } finally {
      setWidgetLoading(id, false)
    }
  }

  // Filtres de fichiers par type de widget
  const getDocsForWidget = (type: string) => {
    if (type === "global") return documents
    if (type === "devis") return documents.filter(doc => doc.name.toLowerCase().includes("devis") && ["pdf","doc","docx","txt"].includes(doc.type.toLowerCase()))
    if (type === "excel") return documents.filter(doc => ["xlsx","xls","csv"].includes(doc.type.toLowerCase()))
    if (type === "pdf") return documents.filter(doc => doc.type.toLowerCase() === "pdf" && !doc.name.toLowerCase().includes("devis"))
    if (type === "txt") return documents.filter(doc => doc.type.toLowerCase() === "txt")
    return []
  }

  // Téléchargement du résumé global
  const handleDownloadSummary = (id: number) => {
    const res = results[id]
    if (!res?.detailedSummary) return
    const blob = new Blob([res.detailedSummary], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "resume_ia.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Chart data pour global
  const getChartData = (res: any): ChartData<'bar', any, unknown> | undefined => {
    if (res?.kpis && res.kpis.length > 0) {
      return {
        labels: res.kpis.map((k: any) => k.label),
        datasets: [
          {
            label: "Valeur",
            data: res.kpis.map((k: any) => parseFloat(k.value) || 0),
            backgroundColor: "#2563eb",
          },
        ],
      }
    }
    return undefined
  }

  // New: export all (ZIP)
  const handleExportAll = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const keys = documents.map(doc => doc.key)
      if (!keys.length) throw new Error("Aucun document à exporter")
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      })
      if (!res.ok) throw new Error("Erreur lors de l'export")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "export_documents.zip"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message || "Erreur export")
    } finally {
      setExporting(false)
    }
  }
  // Upload handler
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUploadError(null)
    setUploading(true)
    setUploadSuccess(false)
    const files = selectedFiles
    if (!files || files.length === 0) {
      setUploadError("Aucun fichier sélectionné")
      setUploading(false)
      return
    }
    const formData = new FormData()
    for (const file of files) {
      formData.append('file', file)
    }
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erreur upload')
      setUploadSuccess(true)
      setTimeout(() => {
        setShowUpload(false)
        setUploadSuccess(false)
        setSelectedFiles([])
        handleRefreshDocs()
      }, 1200)
    } catch (e: any) {
      setUploadError(e.message || 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }
  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    if (e.type === "dragleave") setDragActive(false)
  }
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files))
    }
  }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(Array.from(e.target.files))
  }
  const handleClickInput = () => {
    fileInputRef.current?.click()
  }
  const handleCloseUpload = () => {
    setShowUpload(false)
    setSelectedFiles([])
    setUploadError(null)
    setUploadSuccess(false)
    setUploading(false)
  }

  return (
    <Layout title="Dashboard IA" subtitle="Analyse intelligente de vos documents projet">
      {/* Sticky header ultra-pro */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur flex items-center justify-between px-6 py-3 shadow-sm border-b border-gray-100 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-blue-900 tracking-tight">Dashboard IA</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center gap-1 text-sm px-3 py-1.5" onClick={handleExportAll} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />} Exporter tout
          </Button>
          <Button variant="default" className="flex items-center gap-1 text-sm px-3 py-1.5" onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4" /> Téléverser
          </Button>
          <Button variant="ghost" className="flex items-center gap-1 text-sm px-3 py-1.5" onClick={() => window.open('/help-center', '_blank')}>
            <HelpCircle className="h-4 w-4" /> Aide
          </Button>
        </div>
      </header>
      {/* Résumé explicatif */}
      <section className="bg-blue-50/60 border-b border-blue-100 px-6 py-6 max-w-5xl mx-auto w-full">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">À propos du Dashboard IA</h2>
          <p className="text-gray-700 text-base leading-relaxed">
            Ce tableau de bord vous permet d'analyser rapidement et intelligemment tous vos documents projet (devis, Excel, PDF, TXT, etc.) grâce à l'intelligence artificielle. Ajoutez des widgets d'analyse, sélectionnez les fichiers à traiter, et obtenez des synthèses, KPIs, alertes et graphiques pour piloter vos projets plus efficacement.
          </p>
        </div>
      </section>
      {/* Section widgets */}
      <main className="mx-auto max-w-full py-8 px-2 w-full flex flex-row justify-end">
        <div className="flex flex-col gap-8 w-full max-w-4xl items-end pr-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 w-full">
            <div className="flex gap-4 items-center w-full sm:w-auto">
              <Select value={addType} onValueChange={setAddType}>
                <SelectTrigger className="w-56 h-10 text-base">
                  <SelectValue placeholder="Type de widget" />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map(w => (
                    <SelectItem key={w.value} value={w.value} className="text-base py-2">{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => addWidget(addType)} variant="outline" className="flex items-center gap-1 h-10 px-6 text-base font-medium"><Plus className="h-5 w-5" /> Ajouter</Button>
              <Button onClick={handleRefreshDocs} variant="ghost" className="flex items-center gap-1 h-10 text-base font-medium"><RefreshCw className="h-5 w-5" /> Rafraîchir</Button>
            </div>
          </div>
          {/* Widgets colonne droite */}
          {widgets.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center text-gray-400 text-base py-24 border-2 border-dashed border-blue-100 rounded-xl bg-blue-50/40 w-full">
              <BarChart3 className="h-14 w-14 mx-auto mb-4 text-blue-200" />
              <span className="font-medium">Aucun widget ajouté.<br />Sélectionnez un type et cliquez sur "Ajouter" pour commencer.</span>
            </div>
          )}
          {widgets.map(widget => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              color={getWidgetColor(widget.type)}
              label={getWidgetLabel(widget.type)}
              icon={getWidgetIcon(widget.type)}
              docs={getDocsForWidget(widget.type)}
              sel={selections[widget.id] || []}
              res={results[widget.id]}
              isLoading={loading[widget.id]}
              error={errors[widget.id]}
              onRemove={removeWidget}
              onSelect={select}
              onSelectAll={selectAll}
              onAnalyze={handleAnalyze}
              onDownloadSummary={handleDownloadSummary}
              getChartData={getChartData}
            />
          ))}
        </div>
      </main>
      {/* Upload modal placeholder */}
      <UploadModal
        show={showUpload}
        onClose={handleCloseUpload}
        onUpload={handleUpload}
        uploading={uploading}
        uploadError={uploadError}
        uploadSuccess={uploadSuccess}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        dragActive={dragActive}
        setDragActive={setDragActive}
        fileInputRef={fileInputRef}
      />
    </Layout>
  )
} 