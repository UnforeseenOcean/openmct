/*****************************************************************************
 * Open MCT Web, Copyright (c) 2014-2015, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT Web is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT Web includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

define(
    [],
    function () {

        /**
         * Supports mode-specific time conductor behavior.
         *
         * @constructor
         * @param {TimeConductorMetadata} metadata
         */
        function TimeConductorMode(metadata, conductor, timeSystems) {
            this.conductor = conductor;

            this._metadata = metadata;
            this._deltas = undefined;
            this._tickSource = undefined;
            this._tickSourceUnlisten = undefined;
            this._timeSystems = timeSystems;
            this._availableTickSources = undefined;

            this.changeTimeSystem = this.changeTimeSystem.bind(this);

            //Set the time system initially
            if (conductor.timeSystem()) {
                this.changeTimeSystem(conductor.timeSystem());
            }

            //Listen for subsequent changes to time system
            conductor.on('timeSystem', this.changeTimeSystem);

            if (metadata.key === 'fixed') {
                //Fixed automatically supports all time systems
                this._availableTimeSystems = timeSystems;
            } else {
                this._availableTimeSystems = timeSystems.filter(function (timeSystem) {
                    //Only include time systems that have tick sources that
                    // support the current mode
                    return timeSystem.tickSources().some(function (tickSource) {
                        return metadata.key === tickSource.metadata.mode;
                    });
                });
            }
        }

        /**
         * Get or set the currently selected time system
         * @param timeSystem
         * @returns {TimeSystem} the currently selected time system
         */
        TimeConductorMode.prototype.changeTimeSystem = function (timeSystem) {
            // On time system change, apply default deltas
            var defaults = timeSystem.defaults() || {
                    bounds: {
                        start: 0,
                        end: 0
                    },
                    deltas: {
                        start: 0,
                        end: 0
                    }
                };

            this.conductor.bounds(defaults.bounds);
            this.deltas(defaults.deltas);

            // Tick sources are mode-specific, so restrict tick sources to only those supported by the current mode.
            var key = this._metadata.key;
            var tickSources = timeSystem.tickSources();
            if (tickSources) {
                this._availableTickSources = tickSources.filter(function (source){
                    return source.metadata.mode === key;
                });
            }

            // Set an appropriate tick source from the new time system
            this.tickSource(this.availableTickSources(timeSystem)[0]);
        };

        /**
         * @returns {ModeMetadata}
         */
        TimeConductorMode.prototype.metadata = function () {
            return this._metadata;
        };

        TimeConductorMode.prototype.availableTimeSystems = function () {
            return this._availableTimeSystems;
        };

        /**
         * Tick sources are mode-specific. This returns a filtered list of the tick sources available in the currently selected mode
         * @param timeSystem
         * @returns {Array.<T>}
         */
        TimeConductorMode.prototype.availableTickSources = function (timeSystem) {
            return this._availableTickSources;
        };

        /**
         * Get or set tick source. Setting tick source will also start
         * listening to it and unlisten from any existing tick source
         * @param tickSource
         * @returns {TickSource}
         */
        TimeConductorMode.prototype.tickSource = function (tickSource) {
            if (arguments.length > 0) {
                if (this._tickSourceUnlisten) {
                    this._tickSourceUnlisten();
                }
                this._tickSource = tickSource;
                if (tickSource) {
                    this._tickSourceUnlisten = tickSource.listen(this.tick.bind(this));
                    //Now following a tick source
                    this.conductor.follow(true);
                } else {
                    this.conductor.follow(false);
                }
            }
            return this._tickSource;
        };

        TimeConductorMode.prototype.destroy = function () {
            this.conductor.off('timeSystem', this.changeTimeSystem);

            if (this._tickSourceUnlisten) {
                this._tickSourceUnlisten();
            }
        };

        /**
         * @private
         * @param {number} time some value that is valid in the current TimeSystem
         */
        TimeConductorMode.prototype.tick = function (time) {
            var deltas = this.deltas();
            var startTime = time;
            var endTime = time;

            if (deltas) {
                startTime = time - deltas.start;
                endTime = time + deltas.end;
            }
            this.conductor.bounds({
                start: startTime,
                end: endTime
            });
        };

        /**
         * Get or set the current value for the deltas used by this time system.
         * On change, the new deltas will be used to calculate and set the
         * bounds on the time conductor.
         * @param deltas
         * @returns {TimeSystemDeltas}
         */
        TimeConductorMode.prototype.deltas = function (deltas) {
            if (arguments.length !== 0) {
                var oldEnd = this.conductor.bounds().end;

                if (this._deltas && this._deltas.end !== undefined){
                    //Calculate the previous raw end value (without delta)
                    oldEnd = oldEnd - this._deltas.end;
                }

                this._deltas = deltas;

                var newBounds = {
                    start: oldEnd - this._deltas.start,
                    end: oldEnd + this._deltas.end
                };

                this.conductor.bounds(newBounds);
            }
            return this._deltas;
        };

        return TimeConductorMode;
    }
);
