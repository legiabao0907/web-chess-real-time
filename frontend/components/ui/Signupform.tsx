"use client";

import { useState } from "react";

type Archetype = "vanguard" | "striker" | "oracle";

export default function SignupForm() {
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype>("striker");

  const archetypes: { id: Archetype; icon: string; label: string }[] = [
    { id: "vanguard", icon: "🛡️", label: "VANGUARD" },
    { id: "striker", icon: "⚔️", label: "STRIKER" },
    { id: "oracle", icon: "✨", label: "ORACLE" },
  ];

  return (
    <div className="bg-[#1a1a24] rounded-xl p-6 md:p-8">
      <h2 className="text-2xl font-bold text-white text-center mb-2">
        Initiate Sequence
      </h2>
      <p className="text-gray-500 text-sm text-center mb-6">
        Forge your identity in the void.
      </p>

      {/* Archetype Selection */}
      <div className="mb-6">
        <label className="text-gray-400 text-xs tracking-wider mb-3 block">
          SELECT ARCHETYPE
        </label>
        <div className="flex gap-2">
          {archetypes.map((archetype) => (
            <button
              key={archetype.id}
              onClick={() => setSelectedArchetype(archetype.id)}
              className={`flex-1 py-3 px-4 rounded-lg flex flex-col items-center gap-1 transition-all ${
                selectedArchetype === archetype.id
                  ? "bg-gradient-to-b from-cyan-500/30 to-purple-500/30 border border-cyan-500/50"
                  : "bg-[#12121a] border border-gray-700 hover:border-gray-600"
              }`}
            >
              <span className="text-xl">{archetype.icon}</span>
              <span className="text-[10px] text-gray-400 tracking-wider">
                {archetype.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Username"
          className="w-full bg-transparent border-b border-gray-700 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
        <input
          type="email"
          placeholder="Email Address"
          className="w-full bg-transparent border-b border-gray-700 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
        <div className="flex gap-4">
          <input
            type="password"
            placeholder="Password"
            className="flex-1 bg-transparent border-b border-gray-700 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <input
            type="password"
            placeholder="Confirm"
            className="flex-1 bg-transparent border-b border-gray-700 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Checkbox */}
      <label className="flex items-center gap-2 mt-6 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-600 bg-transparent checked:bg-cyan-500"
        />
        <span className="text-gray-400 text-sm">
          Accept the Protocols of the Void
        </span>
      </label>

      {/* Submit Button */}
      <button className="w-full mt-6 py-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold tracking-wider hover:from-cyan-400 hover:to-blue-500 transition-all">
        JOIN THE SANCTUARY
      </button>

      {/* Already have account */}
      <p className="text-center mt-4 text-gray-500 text-sm">
        Already Initiated?{" "}
        <a href="#" className="text-cyan-400 hover:underline">
          Return to Terminal
        </a>
      </p>
    </div>
  );
}
