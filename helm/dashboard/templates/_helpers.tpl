{{/* vim: set filetype=mustache: */}}
{{/* Store Platform Helm Chart - Helper Templates */}}

{{/* Expand the name of the chart. */}}
{{- define "store-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Create a default fully qualified app name. */}}
{{- define "store-platform.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/* Create chart name and version */}}
{{- define "store-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common labels */}}
{{- define "store-platform.labels" -}}
helm.sh/chart: {{ include "store-platform.chart" . }}
{{ include "store-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: store-platform
{{- end -}}

{{/* Selector labels */}}
{{- define "store-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "store-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* Service account name */}}
{{- define "store-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "store-platform.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/* Dashboard labels */}}
{{- define "store-platform.dashboard.labels" -}}
{{ include "store-platform.labels" . }}
app.kubernetes.io/component: dashboard
{{- end -}}

{{/* API labels */}}
{{- define "store-platform.api.labels" -}}
{{ include "store-platform.labels" . }}
app.kubernetes.io/component: api
{{- end -}}

{{/* Dashboard fullname */}}
{{- define "store-platform.dashboard.fullname" -}}
{{ include "store-platform.fullname" . }}-dashboard
{{- end -}}

{{/* API fullname */}}
{{- define "store-platform.api.fullname" -}}
{{ include "store-platform.fullname" . }}-api
{{- end -}}

{{/* Database password generation */}}
{{- define "store-platform.database.password" -}}
{{- if .Values.api.database.password -}}
{{- .Values.api.database.password -}}
{{- else -}}
{{- randAlphaNum 32 -}}
{{- end -}}
{{- end -}}
