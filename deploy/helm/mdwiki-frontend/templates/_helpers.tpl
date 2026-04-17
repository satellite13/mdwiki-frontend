{{- define "mdwiki-frontend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "mdwiki-frontend.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "mdwiki-frontend.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "mdwiki-frontend.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "mdwiki-frontend.labels" -}}
helm.sh/chart: {{ include "mdwiki-frontend.chart" . }}
app.kubernetes.io/name: {{ include "mdwiki-frontend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "mdwiki-frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mdwiki-frontend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
