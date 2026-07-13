import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface FormattedAIResponseProps {
  content: string;
  className?: string;
}

export function FormattedAIResponse({ content, className }: FormattedAIResponseProps) {
  const formattedContent = useMemo(() => {
    const formatText = (text: string) => {
      // Convert markdown-like formatting to styled HTML
      let formatted = text;

      // Handle headers (##, ###)
      formatted = formatted.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-emerald-700 mt-4 mb-2">$1</h3>');
      formatted = formatted.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-emerald-800 mt-6 mb-3">$1</h2>');
      formatted = formatted.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-emerald-900 mt-8 mb-4">$1</h1>');

      // Handle bold text (**text**)
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>');

      // Handle bullet points (* item or - item)
      formatted = formatted.replace(/^[*•-] (.+)$/gm, '<li class="flex items-start gap-2 text-sm leading-relaxed"><span class="text-emerald-500 mt-0.5">•</span><span>$1</span></li>');

      // Handle numbered lists (1. item)
      formatted = formatted.replace(/^(\d+)\. (.+)$/gm, '<li class="flex items-start gap-2 text-sm leading-relaxed"><span class="font-semibold text-emerald-600 min-w-[20px]">$1.</span><span>$2</span></li>');

      // Wrap consecutive list items in ul/ol
      formatted = formatted.replace(/(<li[^>]*>.*?<\/li>)(\s*<li[^>]*>.*?<\/li>)*/g, (match) => {
        if (match.includes('min-w-[20px]')) {
          return `<ol class="space-y-1 my-3">${match}</ol>`;
        } else {
          return `<ul class="space-y-1 my-3">${match}</ul>`;
        }
      });

      // Handle drug/dosage highlighting (common patterns)
      formatted = formatted.replace(/\b(Paracetamol|Amoxicillin|Ibuprofen|Artemether|Lumefantrine|Coartem|Zinc|ORS|Vitamin A|Ceftriaxone|Azithromycin|Doxycycline|Metronidazole)\b/gi, 
        '<span class="font-semibold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">$1</span>');

      // Handle dosage patterns (e.g., "500mg", "2 tablets", "10ml")
      formatted = formatted.replace(/\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|tablet|tablets|capsule|capsules|dose|doses|times?\/day|daily|weekly|monthly))\b/gi,
        '<span class="font-medium text-orange-600 bg-orange-50 px-1 py-0.5 rounded">$1</span>');

      // Handle frequency patterns (e.g., "twice daily", "3 times daily")
      formatted = formatted.replace(/\b(once|twice|thrice|once daily|twice daily|three times daily|bid|tid|qid|daily|weekly|monthly)\b/gi,
        '<span class="font-medium text-purple-600 bg-purple-50 px-1 py-0.5 rounded">$1</span>');

      // Handle important warnings/cautions
      formatted = formatted.replace(/\b(warning|caution|important|note|alert|emergency|urgent|critical)\b/gi,
        '<span class="font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-200">$1</span>');

      // Handle lab values (e.g., "Hb 12.5 g/dL", "BP 120/80 mmHg")
      formatted = formatted.replace(/\b([A-Z]{2,3}\s+\d+(?:\.\d+)?\s*(?:g\/dL|mmol\/L|mmHg|\/mmHg|cells\/μL|×10⁹\/L))\b/g,
        '<span class="font-mono text-sm bg-slate-100 px-1 py-0.5 rounded border border-slate-300">$1</span>');

      // Handle time patterns (e.g., "30 minutes", "2 hours", "3 days")
      formatted = formatted.replace(/\b(\d+\s*(?:minutes?|hours?|days?|weeks?|months?))\b/gi,
        '<span class="font-medium text-cyan-600 bg-cyan-50 px-1 py-0.5 rounded">$1</span>');

      // Handle temperature (e.g., "37.5°C", "38°C")
      formatted = formatted.replace(/\b(\d+(?:\.\d+)?°C)\b/g,
        '<span class="font-medium text-red-500 bg-red-50 px-1 py-0.5 rounded">$1</span>');

      // Handle percentages (e.g., "95%", "20%")
      formatted = formatted.replace(/\b(\d+(?:\.\d+)?%)\b/g,
        '<span class="font-medium text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">$1</span>');

      // Handle line breaks
      formatted = formatted.replace(/\n\n/g, '</p><p class="my-3 text-sm leading-relaxed">');
      formatted = formatted.replace(/\n/g, '<br />');

      // Wrap in paragraphs
      if (!formatted.startsWith('<')) {
        formatted = `<p class="text-sm leading-relaxed">${formatted}</p>`;
      }

      return formatted;
    };

    return formatText(content);
  }, [content]);

  return (
    <div 
      className={cn("prose prose-sm max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: formattedContent }}
    />
  );
}
