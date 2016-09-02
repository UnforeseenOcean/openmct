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
    [
        './TimeConductorMode'
    ],
    function (TimeConductorMode) {

        /**
         * A class representing the state of the time conductor view. This
         * exposes details of the UI that are not represented on the
         * TimeConductor API itself such as modes and deltas.
         *
         * @param conductor
         * @param timeSystems
         * @constructor
         */
        function TimeConductorViewService(conductor, timeSystems) {
            this._timeSystems = timeSystems.map(
                function (timeSystemConstructor) {
                    return timeSystemConstructor();
            });

            this._conductor = conductor;
            this._mode = undefined;

            /**
             * @typedef {object} ModeMetadata
             * @property {string} key A unique identifying key for this mode
             * @property {string} cssClass The css class for the glyph
             * representing this mode
             * @property {string} label A short label for this mode
             * @property {string} name A longer name for the mode
             * @property {string} description A description of the mode
             */
            this._availableModes = {
                'fixed': {
                    key: 'fixed',
                    cssclass: 'icon-calendar',
                    label: 'Fixed',
                    name: 'Fixed Timespan Mode',
                    description: 'Query and explore data that falls between two fixed datetimes.'
                }
            };

            function hasTickSource(sourceType, timeSystem) {
                return timeSystem.tickSources().some(function (tickSource){
                    return tickSource.metadata.mode === sourceType;
                });
            }

            var timeSystemsForMode = function (sourceType) {
                return this._timeSystems.filter(hasTickSource.bind(this, sourceType));
            }.bind(this);

            //Only show 'real-time mode' if appropriate time systems available
            if (timeSystemsForMode('realtime').length > 0 ) {
                var realtimeMode = {
                    key: 'realtime',
                    cssclass: 'icon-clock',
                    label: 'Real-time',
                    name: 'Real-time Mode',
                    description: 'Monitor real-time streaming data as it comes in. The Time Conductor and displays will automatically advance themselves based on a UTC clock.'
                };
                this._availableModes[realtimeMode.key] = realtimeMode;
            }

            //Only show 'LAD mode' if appropriate time systems available
            if (timeSystemsForMode('LAD').length > 0) {
                var ladMode = {
                    key: 'LAD',
                    cssclass: 'icon-database',
                    label: 'LAD',
                    name: 'LAD Mode',
                    description: 'Latest Available Data mode monitors real-time streaming data as it comes in. The Time Conductor and displays will only advance when data becomes available.'
                };
                this._availableModes[ladMode.key] = ladMode;
            }
        }

        /**
         * Getter/Setter for the Time Conductor Mode. Modes determine the
         * behavior of the time conductor, especially with regards to the
         * bounds and how they change with time.
         *
         * In fixed mode, the bounds do not change with time, but can be
         * modified by the used
         *
         * In realtime mode, the bounds change with time. Bounds are not
         * directly modifiable by the user, however deltas can be.
         *
         * In Latest Available Data (LAD) mode, the bounds are updated when
         * data is received. As with realtime mode the
         *
         * @param {string} newModeKey One of 'fixed', 'realtime', or 'LAD'
         * @returns {string} the current mode, one of 'fixed', 'realtime',
         * or 'LAD'.
         *
         */
        TimeConductorViewService.prototype.mode = function (newModeKey) {
            if (arguments.length === 1) {
                var timeSystem = this._conductor.timeSystem();
                var modes = this.availableModes();
                var modeMetaData = modes[newModeKey];

                if (this._mode) {
                    this._mode.destroy();
                }
                this._mode = new TimeConductorMode(modeMetaData, this._conductor, this._timeSystems);

                function contains(timeSystems, timeSystem) {
                    return timeSystems.filter(function (t) {
                            return t.metadata.key === timeSystem.metadata.key;
                        }).length > 0;
                }

                // If no time system set on time conductor, or the currently selected time system is not available in
                // the new mode, default to first available time system
                if (!timeSystem || !contains(this._mode.availableTimeSystems(), timeSystem)) {
                    timeSystem = this._mode.availableTimeSystems()[0];
                    this._conductor.timeSystem(timeSystem, timeSystem.defaults().bounds);
                }
            }
            return this._mode ? this._mode.metadata().key : undefined;
        };

        /**
         * @typedef {object} Delta
         * @property {number} start Used to set the start bound of the
         * TimeConductor on tick. A positive value that will be subtracted
         * from the value provided by a tick source to determine the start
         * bound.
         * @property {number} end Used to set the end bound of the
         * TimeConductor on tick. A positive value that will be added
         * from the value provided by a tick source to determine the start
         * bound.
         */
        /**
         * Deltas define the offset from the latest time value provided by
         * the current tick source. Deltas are only valid in realtime or LAD
         * modes.
         *
         * Realtime mode:
         *     - start: A time in ms before now which will be used to
         *     determine the 'start' bound on tick
         *     - end: A time in ms after now which will be used to determine
         *     the 'end' bound on tick
         *
         * LAD mode:
         *     - start: A time in ms before the timestamp of the last data
         *     received which will be used to determine the 'start' bound on
         *     tick
         *     - end: A time in ms after the timestamp of the last data received
         *     which will be used to determine the 'end' bound on tick
         * @returns {Delta} current value of the deltas
         */
        TimeConductorViewService.prototype.deltas = function () {
            //Deltas stored on mode. Use .apply to preserve arguments
            return this._mode.deltas.apply(this._mode, arguments)
        };

        /**
         * Availability of modes depends on the time systems and tick
         * sources available. For example, Latest Available Data mode will
         * not be available if there are no time systems and tick sources
         * that support LAD mode.
         * @returns {ModeMetadata[]}
         */
        TimeConductorViewService.prototype.availableModes = function () {
            return this._availableModes;
        };

        /**
         * Availability of time systems depends on the currently selected
         * mode. Time systems and tick sources are mode dependent
         */
        TimeConductorViewService.prototype.availableTimeSystems = function () {
            return this._mode.availableTimeSystems();
        };

        return TimeConductorViewService;
    }
);
