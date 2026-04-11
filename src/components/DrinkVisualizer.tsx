import React from 'react';
import { Drink } from '../types';
import { cn } from '../lib/utils';
import { useIngredients } from '../hooks/useIngredients';

interface DrinkVisualizerProps {
  drink: Partial<Drink>;
  className?: string;
}

export function DrinkVisualizer({ drink, className }: DrinkVisualizerProps) {
  const ingredients = useIngredients();
  const layers = drink.layer_order || [];

  const renderLayer = (layerId: string, index: number, total: number) => {
    const ingredient = ingredients.find(i => i.id === layerId);
    const heightPercent = 100 / Math.max(total, 1);
    
    let bgColor = ingredient?.color || 'transparent';
    let content = null;
    let customClass = '';

    if (layerId === 'foam') {
      customClass = 'border-t border-amber-100 opacity-90';
      content = <div className="w-full h-full flex flex-wrap gap-1 p-1 opacity-50">
        {[...Array(5)].map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-amber-100" />)}
      </div>;
    } else if (layerId === 'whipped_cream') {
      customClass = 'rounded-t-full shadow-sm';
    } else if (layerId === 'sprinkles') {
      content = <div className="w-full h-full flex flex-wrap gap-1 p-1 justify-center items-center">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
      </div>;
    } else if (layerId === 'ice') {
      content = <div className="w-full h-full flex flex-wrap gap-1 p-1 justify-center items-center opacity-70">
        <div className="w-4 h-4 rounded-sm bg-blue-100/80 border border-blue-200/50 rotate-12" />
        <div className="w-4 h-4 rounded-sm bg-blue-100/80 border border-blue-200/50 -rotate-12" />
        <div className="w-4 h-4 rounded-sm bg-blue-100/80 border border-blue-200/50 rotate-45" />
      </div>;
    } else if (layerId === 'biscuit') {
      content = <div className="w-full h-full flex justify-center items-center">
        <div className="w-8 h-3 rounded-sm bg-amber-800 border-b-2 border-amber-900" />
      </div>;
    }

    const isHex = bgColor.startsWith('#') || bgColor.startsWith('rgb') || bgColor === 'transparent';
    const style = isHex ? { height: `${heightPercent}%`, backgroundColor: bgColor } : { height: `${heightPercent}%` };
    const classes = cn("w-full relative transition-all duration-300", customClass, !isHex && bgColor);

    return (
      <div 
        key={`${layerId}-${index}`} 
        className={classes}
        style={style}
      >
        {content}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col items-center justify-end w-32 h-48", className)}>
      <div className="relative w-24 h-40 border-4 border-t-0 border-white/40 rounded-b-2xl overflow-hidden flex flex-col-reverse bg-white/10 backdrop-blur-sm shadow-inner">
        {layers.map((layer, index) => renderLayer(layer, index, layers.length))}
      </div>
      <div className="w-16 h-2 bg-white/40 rounded-full mt-1 blur-[1px]" />
    </div>
  );
}
