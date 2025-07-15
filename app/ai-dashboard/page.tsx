"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Download, BarChart3, FileText, HelpCircle, RefreshCw } from "lucide-react"
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartData, PointElement, LineElement, ArcElement } from "chart.js"
import { Bar, Line, Pie } from "react-chartjs-2"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { X, Plus } from "lucide-react"
import { useSearchParams } from "next/navigation";
// @ts-ignore
import jsPDF from "jspdf";
// @ts-ignore
import html2canvas from "html2canvas";

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
    const labels = Array.isArray(chartData.labels) ? chartData.labels.filter((l: string) => l !== null && l !== undefined && l !== "") : [];
    const dataArr = Array.isArray(chartData.datasets?.[0]?.data) ? chartData.datasets[0].data.map((v: number) => (typeof v === 'number' && !isNaN(v) ? v : 0)) : [];
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
  const [selectedChartIdxs, setSelectedChartIdxs] = useState<Record<number, number>>({});
  const [customChartQueries, setCustomChartQueries] = useState<Record<number, string>>({});
  const [customChartLoading, setCustomChartLoading] = useState<Record<number, boolean>>({});
  const [customChartResults, setCustomChartResults] = useState<Record<number, any>>({});
  const [customChartErrors, setCustomChartErrors] = useState<Record<number, string | null>>({});
  const [analysisDone, setAnalysisDone] = useState(false);
  const [showManualChart, setShowManualChart] = useState(false);
  const [manualX, setManualX] = useState<string>('');
  const [manualY, setManualY] = useState<string>('');
  const [manualType, setManualType] = useState<'bar'|'line'|'pie'>('bar');
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualPhrase, setManualPhrase] = useState('');
  const favKey = `excelManualFavorites_${widget.id}`;
  const [manualFavorites, setManualFavorites] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(favKey) || '[]');
    } catch { return []; }
  });
  const widgetRef = useRef<HTMLDivElement>(null);
  const handleExportPDF = async () => {
    if (!widgetRef.current) return;
    const canvas = await html2canvas(widgetRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = canvas.height * (imgWidth / canvas.width);
    let y = 20;
    pdf.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);
    pdf.save(`${label.replace(/\s+/g, '_').toLowerCase()}_widget.pdf`);
  };

  useEffect(() => {
    if (res && !analysisDone) setAnalysisDone(true);
  }, [res]);

  useEffect(() => {
    localStorage.setItem(favKey, JSON.stringify(manualFavorites));
  }, [manualFavorites, favKey]);

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

  let devisRes: any[] | { error: string } | null = null;
  if (widget.type === "devis") {
    if (Array.isArray(res)) devisRes = res as any[];
    else if (res && typeof res === 'object' && 'error' in res) devisRes = res as { error: string };
    else devisRes = null;
  }

  return (
    <div ref={widgetRef} className={`mb-8 w-full bg-white border-l-4 border-${color}-500 rounded-xl shadow-lg flex flex-col`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          {icon}
          <CardTitle className={`text-${color}-900 text-xl font-bold`}>{label}</CardTitle>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportPDF} title="Exporter tout le widget en PDF">
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRemove(widget.id)} title="Supprimer le widget">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-1 flex-1 flex flex-col">
        {!analysisDone && (
          <>
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
              <Button onClick={() => onAnalyze(widget.id, widget.type)} disabled={isLoading || analysisDone} className="w-full h-10 text-base font-semibold flex items-center justify-center">
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
          </>
        )}
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
        {widget.type === "excel" && res && (
          <div className="mt-6 space-y-6">
            <h3 className="text-green-900 font-bold text-lg mb-2 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" /> Analyse Excel/CSV
            </h3>
            {Array.isArray(res) && res.length > 0 ? (
              res.map((item: any, idx: number) => {
                if (!item) return null;
                const charts = item.charts || [];
                const selectedChartIdx = selectedChartIdxs[idx] || 0;
                const selectedChart = charts[selectedChartIdx];
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
                        <div key={"custom-chart-"+idx} className="mt-2">
                          <input
                            type="text"
                            placeholder="Ex: coûts en fonction du personnel"
                            value={customChartQueries[idx] || ''}
                            onChange={e => setCustomChartQueries(q => ({ ...q, [idx]: e.target.value }))}
                            className="border rounded px-2 py-1 text-sm w-72 mr-2"
                          />
                          <Button
                            size="sm"
                            onClick={async () => {
                              setCustomChartLoading(l => ({ ...l, [idx]: true }));
                              setCustomChartErrors(e => ({ ...e, [idx]: null }));
                              try {
                                const resp = await fetch("/api/ai-analyze/excel-custom-chart", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ key: item.key, query: customChartQueries[idx] })
                                });
                                const data = await resp.json();
                                if (data.chart) {
                                  setCustomChartResults(r => ({ ...r, [idx]: data }));
                                } else {
                                  setCustomChartErrors(e => ({ ...e, [idx]: data.error || "Erreur inconnue" }));
                                }
                              } catch (err: any) {
                                setCustomChartErrors(e => ({ ...e, [idx]: err.message }));
                              } finally {
                                setCustomChartLoading(l => ({ ...l, [idx]: false }));
                              }
                            }}
                            disabled={!customChartQueries[idx] || customChartLoading[idx]}
                          >
                            {customChartLoading[idx] ? "Chargement..." : "Générer graphique personnalisé"}
                          </Button>
                          {customChartErrors[idx] && <div className="text-red-600 text-xs mt-1">{customChartErrors[idx]}</div>}
                          {customChartResults[idx]?.chart && (
                            <div className="mt-3">
                              <ChartWithExport
                                chartType={customChartResults[idx].chart.type}
                                chartData={{
                                  labels: customChartResults[idx].data.map((row: any) => row[customChartResults[idx].chart.x]),
                                  datasets: [{
                                    label: customChartResults[idx].chart.y,
                                    data: customChartResults[idx].data.map((row: any) => parseFloat(row[customChartResults[idx].chart.y]) || 0),
                                    backgroundColor: '#22c55e',
                                    borderColor: '#22c55e',
                                  }],
                                }}
                                chartOptions={{ responsive: true, plugins: { legend: { display: true } } }}
                                title={customChartResults[idx].chart.title}
                                explanation={customChartResults[idx].chart.explanation}
                                axes={`Axe X : ${customChartResults[idx].chart.x} | Axe Y : ${customChartResults[idx].chart.y}`}
                              />
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowManualChart(v => !v)}>
                          {showManualChart ? 'Annuler la création manuelle' : 'Créer un graphique personnalisé'}
                        </Button>
                        {showManualChart && (
                          <div className="mt-3 p-3 border rounded bg-gray-50">
                            <div className="mb-2 font-semibold">Créer un graphique personnalisé</div>
                            <div className="flex flex-col gap-2 mb-3">
                              <label className="font-medium">Décrivez le graphique souhaité (ex: coût par département, camembert des effectifs par chef d'équipe) :</label>
                              <div className="flex gap-2">
                                <input value={manualPhrase} onChange={e => setManualPhrase(e.target.value)} className="flex-1 border rounded px-2 py-1" placeholder="Ex: coût par département" />
                                <Button size="sm" onClick={() => {
                                  // Suggestion locale simple : détecter les mots clés dans la phrase
                                  const phrase = manualPhrase.toLowerCase();
                                  let type: 'bar'|'line'|'pie' = 'bar';
                                  if (phrase.includes('camembert') || phrase.includes('pie')) type = 'pie';
                                  if (phrase.includes('courbe') || phrase.includes('line')) type = 'line';
                                  // Trouver X et Y par heuristique simple
                                  const cols = item.data && Object.keys(item.data[0] || {});
                                  let x = '';
                                  let y = '';
                                  if (cols) {
                                    for (const col of cols) {
                                      if (phrase.includes(col.toLowerCase())) {
                                        if (!x) x = col;
                                        else if (!y) y = col;
                                      }
                                    }
                                    // Si pas trouvé, fallback
                                    if (!x) x = cols[0];
                                    if (!y) y = cols.find((c: string) => item.data.some((row: any) => !isNaN(parseFloat(row[c])))) || cols[1] || cols[0];
                                  }
                                  setManualType(type);
                                  setManualX(x);
                                  setManualY(y);
                                  setManualTitle(manualPhrase);
                                }}>Générer automatiquement</Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2 items-end">
                              <label>Colonne X :
                                <select value={manualX} onChange={e => setManualX(e.target.value)} className="ml-2 border rounded px-2 py-1">
                                  <option value="">--</option>
                                  {item.data && Object.keys(item.data[0] || {}).map(col => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                              </label>
                              <label>Colonne Y :
                                <select value={manualY} onChange={e => setManualY(e.target.value)} className="ml-2 border rounded px-2 py-1">
                                  <option value="">--</option>
                                  {item.data && Object.keys(item.data[0] || {}).filter((col: string) => item.data.some((row: any) => !isNaN(parseFloat(row[col])))).map(col => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                              </label>
                              <label>Type :
                                <select value={manualType} onChange={e => setManualType(e.target.value as any)} className="ml-2 border rounded px-2 py-1">
                                  <option value="bar">Barres</option>
                                  <option value="line">Courbe</option>
                                  <option value="pie">Camembert</option>
                                </select>
                              </label>
                              <label>Titre :
                                <input value={manualTitle} onChange={e => setManualTitle(e.target.value)} className="ml-2 border rounded px-2 py-1" placeholder="Titre du graphique" />
                              </label>
                            </div>
                            {manualX && manualY && (
                              <>
                                <ChartWithExport
                                  chartType={manualType}
                                  chartData={{
                                    labels: item.data.map((row: any) => row[manualX]),
                                    datasets: [{
                                      label: manualY,
                                      data: item.data.map((row: any) => parseFloat(row[manualY]) || 0),
                                      backgroundColor: '#22c55e',
                                      borderColor: '#22c55e',
                                    }],
                                  }}
                                  chartOptions={{ responsive: true, plugins: { legend: { display: true } } }}
                                  title={manualTitle || `${manualType} de ${manualY} par ${manualX}`}
                                  axes={`Axe X : ${manualX} | Axe Y : ${manualY}`}
                                />
                                <Button size="sm" className="mt-2" onClick={() => {
                                  setManualFavorites(favs => [
                                    ...favs,
                                    { x: manualX, y: manualY, type: manualType, title: manualTitle }
                                  ]);
                                }}>Ajouter aux favoris</Button>
                              </>
                            )}
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
          <div className="mt-6 space-y-6">
            <h3 className="text-pink-900 font-bold text-lg mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-pink-600" /> Analyse Devis
            </h3>
            {Array.isArray(devisRes) && devisRes.length > 0 ? (
              devisRes.map((item: any, idx: number) => {
                if (!item) return null;
                const local = item.localExtract || {};
                // Calcul cohérence totaux
                let sumLignes = 0;
                if (item.lignes && Array.isArray(item.lignes)) {
                  sumLignes = item.lignes.reduce((acc: number, l: any) => acc + (parseFloat(l.totalLigne || l.total || 0) || 0), 0);
                }
                const incoherence = item.totalHT && Math.abs(sumLignes - parseFloat(item.totalHT)) > 1;
                return (
                  <React.Fragment key={idx}>
                    {local.warning && (
                      <section className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
                        <div className="text-yellow-800 font-semibold mb-2 flex items-center gap-2">
                          ⚠️ {local.warning}
                        </div>
                        <div className="mb-2">
                          <span className="font-medium text-gray-700">Texte extrait du PDF&nbsp;:</span>
                          <pre className="bg-gray-100 p-2 rounded text-xs max-h-64 overflow-auto border mt-1">{local.cleanedText?.slice(0, 5000) || "(vide)"}</pre>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          const blob = new Blob([local.cleanedText || ""], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'texte_extrait_devis.txt';
                          a.click();
                          URL.revokeObjectURL(url);
                        }}>Télécharger le texte extrait</Button>
                      </section>
                    )}
                    {!local.warning && (
                      <>
                        <div className={`mb-3 p-3 rounded flex gap-6 items-center ${incoherence ? 'bg-red-100 border border-red-400' : 'bg-pink-100 border border-pink-200'}`}>
                          <div>
                            <span className="text-xs text-gray-500">Total HT</span><br/>
                            <span className="text-lg font-bold text-pink-900">{item.totalHT || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">TVA</span><br/>
                            <span className="text-lg font-bold text-pink-900">{item.tva || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Total TTC</span><br/>
                            <span className="text-lg font-bold text-pink-900">{item.totalTTC || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Somme lignes</span><br/>
                            <span className="text-lg font-bold text-pink-900">{sumLignes.toFixed(2)}</span>
                          </div>
                          {incoherence && <span className="text-red-700 font-semibold ml-4">Incohérence détectée !</span>}
                        </div>
                        {item.lignes && Array.isArray(item.lignes) && item.lignes.length > 0 && (
                          <div className="overflow-x-auto mb-2">
                            <table className="min-w-full border text-xs bg-white">
                              <thead>
                                <tr>
                                  {Object.keys(item.lignes[0]).map((col, i) => <th key={i} className="border px-2 py-1 bg-pink-100 text-pink-900">{col}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {item.lignes.map((ligne: any, i: number) => (
                                  <tr key={i} className={local.lines && local.lines[i] && JSON.stringify(ligne) !== JSON.stringify(local.lines[i]) ? 'bg-yellow-50' : ''}>
                                    {Object.values(ligne).map((val, j) => <td key={j} className="border px-2 py-1">{val !== null && val !== undefined ? val.toString() : ""}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <Button size="sm" variant="outline" className="mt-2" onClick={() => {
                              const csv = [Object.keys(item.lignes[0]).join(',')].concat(item.lignes.map((l: any) => Object.values(l).join(','))).join('\n');
                              const blob = new Blob([csv], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'devis_lignes.csv';
                              a.click();
                              URL.revokeObjectURL(url);
                            }}>Exporter CSV</Button>
                          </div>
                        )}
                      </>
                    )}
                  </React.Fragment>
                );
              })
            ) : devisRes && typeof devisRes === 'object' && 'error' in devisRes ? (
              <div className="text-red-600">{devisRes.error}</div>
            ) : (
              <div className="text-gray-500">Aucun résultat d'analyse.</div>
            )}
          </div>
        )}
        {manualFavorites.length > 0 && (
          <div className="mt-4">
            <div className="font-semibold mb-1">Favoris graphiques</div>
            <ul className="space-y-1">
              {manualFavorites.map((fav, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => {
                    setManualX(fav.x); setManualY(fav.y); setManualType(fav.type); setManualTitle(fav.title);
                  }}>{fav.title || `${fav.type} de ${fav.y} par ${fav.x}`}</Button>
                  <Button size="icon" variant="ghost" onClick={() => setManualFavorites(favs => favs.filter((_, j) => j !== i))}>🗑️</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </div>
  )
}

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
  const searchParams = useSearchParams();
  const affaireParam = searchParams?.get('affaire');
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
  const [showUpload, setShowUpload] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string|null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showSelection, setShowSelection] = useState(true); // par défaut ouvert

  useEffect(() => {
    const fetchDocuments = async () => {
      const res = await fetch("/api/documents")
      const data = await res.json()
      setDocuments(data.documents || [])
    }
    fetchDocuments()
  }, [])

  const handleRefreshDocs = async () => {
    setWidgetLoading('global' as any, true)
    const res = await fetch("/api/documents")
    const data = await res.json()
    setDocuments(data.documents || [])
    setWidgetLoading('global' as any, false)
  }

  const handleAnalyze = async (id: number, type: string) => {
    setShowSelection(false); 
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

  const getDocsForWidget = (type: string) => {
    if (type === "global") return documents
    if (type === "devis") return documents.filter(doc => doc.name.toLowerCase().includes("devis") && ["pdf","doc","docx","txt"].includes(doc.type.toLowerCase()))
    if (type === "excel") return documents.filter(doc => ["xlsx","xls","csv"].includes(doc.type.toLowerCase()))
    if (type === "pdf") return documents.filter(doc => doc.type.toLowerCase() === "pdf" && !doc.name.toLowerCase().includes("devis"))
    if (type === "txt") return documents.filter(doc => doc.type.toLowerCase() === "txt")
    return []
  }

  // Filtrer les documents par affaire si affaireParam est défini
  const filteredDocuments = affaireParam
    ? documents.filter(doc => doc.key.includes(affaireParam))
    : documents;

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
    <div className="w-full max-w-none py-8 px-2 md:px-8">
      {affaireParam && (
        <div className="mb-6 flex justify-start">
          <a
            href={`/affaires/${affaireParam}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sncf-red text-white font-semibold text-base shadow hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sncf-red focus:ring-offset-2"
            title={`Retour à l'affaire ${affaireParam}`}
          >
            <span className="text-lg">←</span>
            Affaire {affaireParam}
          </a>
        </div>
      )}
      {/* TopNavBar est déjà inclus par le layout global */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur flex items-center justify-between px-6 py-3 shadow-sm border-b border-gray-100 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-blue-900 tracking-tight">
            Dashboard IA {affaireParam && <span className="text-gray-500 font-normal ml-2">Affaire {affaireParam}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center gap-1 text-sm px-3 py-1.5" onClick={handleExportAll} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />} Exporter tout
          </Button>
          <Button variant="default" className="flex items-center gap-1 text-sm px-3 py-1.5" onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4" /> Téléverser
          </Button>
          <Button variant="ghost" className="flex items-center gap-1 text-sm px-3 py-1.5" onClick={() => window.open('/home-page', '_blank')}>
            <HelpCircle className="h-4 w-4" /> Aide
          </Button>
        </div>
      </header>
      <section className="bg-blue-50/60 border-b border-blue-100 px-6 py-6 max-w-5xl mx-auto w-full">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">À propos du Dashboard IA</h2>
          <p className="text-gray-700 text-base leading-relaxed">
            Ce tableau de bord vous permet d'analyser rapidement et intelligemment tous vos documents projet (devis, Excel, PDF, TXT, etc.) grâce à l'intelligence artificielle. Ajoutez des widgets d'analyse, sélectionnez les fichiers à traiter, et obtenez des synthèses, KPIs, alertes et graphiques pour piloter vos projets plus efficacement.
          </p>
        </div>
      </section>
      <main className="mx-auto max-w-full py-8 px-2 w-full flex flex-row justify-center">
        <div className="flex flex-col gap-8 w-full max-w-4xl items-center mx-auto">
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
              docs={(() => {
                // Utilise filteredDocuments au lieu de documents
                if (widget.type === "global") return filteredDocuments;
                if (widget.type === "devis") return filteredDocuments.filter(doc => doc.name.toLowerCase().includes("devis") && ["pdf","doc","docx","txt"].includes(doc.type.toLowerCase()));
                if (widget.type === "excel") return filteredDocuments.filter(doc => ["xlsx","xls","csv"].includes(doc.type.toLowerCase()));
                if (widget.type === "pdf") return filteredDocuments.filter(doc => doc.type.toLowerCase() === "pdf" && !doc.name.toLowerCase().includes("devis"));
                if (widget.type === "txt") return filteredDocuments.filter(doc => doc.type.toLowerCase() === "txt");
                return [];
              })()}
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
    </div>
  )
} 