import React from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Animated,
    TouchableOpacity,
    NativeModules,
    LayoutAnimation,
} from "react-native";
import debugService from "./debug-service";
import InvertibleScrollView from "react-native-invertible-scroll-view";
const NativeAnimatedModule = NativeModules.NativeAnimatedModule;

const DEFAULT_BORDER_COLOR = "#2a2a2a";
const DEFAULT_SELECT_COLOR = "#1e1e1e";
const DEFAULT_SEPARATOR_COLOR = "#ffd60a";
const DEFAULT_BACKGROUND_COLOR = "#0d0d0d";
const DEFAULT_TEXT_COLOR = "#e0e0e0";


export default class Debug extends React.Component {

    constructor(props) {
        super(props);

        this.preparedRows = { blob: {} };
        this.listViewRef = null;
        this.state = {
            dataSource: [],
            paused: props.paused,
            rows: [],
        };
        this.styleSheet = getStyleSheet(props)
    }

    prepareRows(rows) {
        return rows.reduce((o, m) => {
            const previousRender =
                this.preparedRows !== undefined
                    ? this.preparedRows[m.id]
                    : null;
            const previousRenderExists = !!previousRender;
            o[m.id] = {
                ...m,
                anim: previousRenderExists
                    ? previousRender.anim
                    : new Animated.Value(0),
            };
            return o;
        }, []);
    }

    isPaused(){
        return !this.props.paused && !this.state.paused;
    }

    renderList(props) {
        if (this.isPaused()) {
            this.preparedRows = this.prepareRows(props.rows);
            let rowsToRender = [];
            if(this.preparedRows){
                rowsToRender = Object.values(this.preparedRows);
            }
            this.setState({
                rows: props.rows,
                dataSource: rowsToRender
            });
        }
    }

    componentWillReceiveProps(nextProps) {
        this.renderList(nextProps);
        this.styleSheet = getStyleSheet(this.props)
    }

    onPauseButtonPressed() {
        this.setState({
            paused: !this.state.paused,
        });
        this.renderList(this.props);
    }

    onClearButtonPressed() {
        debugService.clear();
    }

    _formatTimeStamp(timeStamp, rowData) {
        if (rowData.format) {
            return rowData.format(timeStamp);
        }
        return timeStamp.format(this.props.timeStampFormat || "HH:mm:ss");
    }

    onRowPress(rowID) {
        // Create a new array to avoid mutating state directly
        const updatedRows = this.state.rows.map(row => {
            if (this.props.multiExpanded) {
                // Multi-expand mode: toggle only the clicked row
                if (row.id === rowID) {
                    return { ...row, expanded: !row.expanded };
                }
                return row;
            } else {
                // Single-expand mode: collapse all others, toggle clicked row
                return {
                    ...row,
                    expanded: row.id === rowID ? !row.expanded : false
                };
            }
        });

        this.preparedRows = this.prepareRows(updatedRows);
        LayoutAnimation.configureNext({
            update: {
                springDamping: 0.7,
                type: "spring",
            },
            duration: 650,
        });
        let rowsToRender = [];
        if(this.preparedRows){
            rowsToRender = Object.values(this.preparedRows);
        }
        this.setState({
            rows: updatedRows,
            dataSource: rowsToRender
        });
    }

    onRowLayout(rowData) {
        Animated.timing(rowData.anim, {
            useNativeDriver: !!NativeAnimatedModule,
            toValue: 1,
            duration: 700,
        }).start();
    }

    _renderSeparator(rowData, animationStyle) {
        const separatorStyles = [
            this.styleSheet.logRowMessage,
            this.styleSheet.logRowMessageBold,
            this.styleSheet.separator,
        ];
        return (
            <Animated.View
                style={[this.styleSheet.debugRowContainer, animationStyle]}
                onLayout={this.onRowLayout.bind(this, rowData)}
            >
                {this.props.renderLevel && <Text style={separatorStyles}>*****</Text>}
                <Text
                    style={[
                        this.styleSheet.logRowMessage,
                        this.styleSheet.logRowMessageMain,
                        this.styleSheet.logRowMessageSeparator,
                    ]}
                >
                    {rowData.message}
                    - {rowData.timeStamp.format("YYYY-MM-DD HH:mm:ss")}
                </Text>
                {this.props.renderTimestamp && <Text style={separatorStyles}>*****</Text>}
            </Animated.View>
        );
    }

    _renderLogRow(rowData, rowID, animationStyle) {
        return (
            <Animated.View
                style={[
                    this.styleSheet.debugRowContainer,
                    animationStyle,
                    {
                        backgroundColor: rowData.expanded
                            ? this.styleSheet.selectColor
                            : "transparent",
                    },
                ]}
                onLayout={this.onRowLayout.bind(this, rowData)}
            >
                <TouchableOpacity
                    style={this.styleSheet.debugRowContainerButton}
                    onPress={this.onRowPress.bind(this, rowID)}
                >
                    {this.props.renderLevel && <Text
                        style={[this.styleSheet.logRowMessage, this.styleSheet.logRowLevelLabel]}
                    >
                        {`[${rowData.level.toUpperCase()}]`}
                    </Text>}
                    <Text
                        style={[
                            this.styleSheet.logRowMessage,
                            this.styleSheet.logRowMessageMain,
                            {
                                color: rowData.color,
                            },
                        ]}
                        numberOfLines={rowData.expanded ? undefined : 1}
                        ellipsizeMode="tail"
                    >
                        {rowData.message}
                    </Text>
                    {this.props.renderTimestamp && <Text style={this.styleSheet.logRowMessage}>
                        {this._formatTimeStamp(rowData.timeStamp, rowData)}
                    </Text>}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    _getRowKey(rowData){
        return rowData.id
    }
    
    _renderRow(row) {
        let animationStyle = {};
        const rowData = row.item;
        const rowID = rowData.id;
        if (rowData.anim) {
            animationStyle = {
                opacity: rowData.anim,
                transform: [
                    {
                        scale: rowData.anim.interpolate({
                            inputRange: [0, 0.3, 1],
                            outputRange: [1, 1.05, 1],
                        }),
                    },
                ],
            };
        }

        switch (rowData.level) {
            case "separator":
                return this._renderSeparator(
                    rowData,
                    animationStyle
                );
            default:
                return this._renderLogRow(
                    rowData,
                    rowID,
                    animationStyle
                );
        }
    }

    onCenterColumnPressed() {
        if (this.listViewRef) {
            this.listViewRef.scrollTo({ x: 0, y: 0, animated: true });
        }
    }

    renderToolbar(){
        if(this.props.renderToolbar){
            let options = {
                onPause: this.onPauseButtonPressed.bind(this), 
                onClear: this.onClearButtonPressed.bind(this), 
                length: this.state.rows
            }
            return this.props.renderToolbar(options)
        }
        return (<View style={this.styleSheet.toolBar}>
            <TouchableOpacity
                style={this.styleSheet.toolbarButton}
                onPress={this.onPauseButtonPressed.bind(this)}
            >
                <Text style={this.styleSheet.toolbarButtonText}>
                    {this.state.paused ? "Resume log" : "Pause log"}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={this.onCenterColumnPressed.bind(this)}
                style={this.styleSheet.centerColumn}
            >
                <Text style={this.styleSheet.titleText}>{`${this.state.rows
                    .length} rows`}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={this.styleSheet.toolbarButton}
                onPress={this.onClearButtonPressed.bind(this)}
            >
                <Text style={this.styleSheet.toolbarButtonText}>Clear log</Text>
            </TouchableOpacity>
        </View>)
    }

    render() {
        const { rows, ...props } = this.props;
        return (
            <View style={this.styleSheet.container}>
                {this.renderToolbar()}
                <View style={this.styleSheet.listContainer}>
                    <FlatList
                        keyboardShouldPersistTaps="always"
                        automaticallyAdjustContentInsets={false}
                        initialListSize={20}
                        pageSize={20}
                        renderScrollComponent={props => (
                            <InvertibleScrollView
                                {...props}
                                inverted={this.props.inverted}
                            />
                        )}
                        enableEmptySections={true}
                        ref={ref => this.listViewRef = ref}
                        data={this.state.dataSource}
                        renderItem={this._renderRow.bind(this)}
                        keyExtractor={this._getRowKey.bind(this)}
                        {...props}
                    />
                </View>
            </View>
        );
    }
}

const getStyleSheet = (props)=>{
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: props.backgroundColor,
        },
        toolBar: {
            backgroundColor: props.backgroundColor,
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: props.borderColor,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
        },
        toolbarButton: {
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: props.borderColor,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
            elevation: 2,
        },
        centerColumn: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
        },
        titleText: {
            color: props.textColor,
            fontWeight: "600",
            fontFamily: "System",
            fontSize: 15,
            letterSpacing: 0.3,
            opacity: 0.9,
        },
        toolbarButtonText: {
            color: props.textColor,
            fontFamily: "System",
            fontSize: 13,
            fontWeight: "500",
        },
        listContainer: {
            flex: 1,
        },
        debugRowContainer: {
            paddingVertical: 10,
            paddingHorizontal: 12,
            flex: 1,
            flexDirection: "row",
            backgroundColor: props.backgroundColor,
            borderStyle: "solid",
            borderBottomWidth: 1,
            borderBottomColor: props.borderColor,
        },
        debugRowContainerButton: {
            flexDirection: "row",
            flex: 1,
            overflow: "hidden",
        },
        logRowMessage: {
            color: props.textColor,
            fontFamily: "System",
            fontSize: 13,
            paddingHorizontal: 8,
            lineHeight: 20,
        },
        logRowMessageBold: {
            fontWeight: "700",
        },
        logRowLevelLabel: {
            minWidth: 85,
            fontWeight: "700",
            fontSize: 12,
            letterSpacing: 0.5,
            opacity: 0.85,
        },
        logRowMessageSeparator: {
            fontSize: 12,
            fontWeight: "700",
            textAlign: "center",
            color: props.separatorColor,
            letterSpacing: 1,
        },
        separator: {
            fontSize: 16,
            color: props.separatorColor,
            fontWeight: "700",
        },
        logRowMessageMain: {
            flex: 1,
        },
        welcome: {
            fontSize: 20,
            textAlign: "center",
            margin: 10,
        },
        instructions: {
            textAlign: "center",
            color: "#333333",
            marginBottom: 5,
        },
    });
}

Debug.defaultProps = {
    borderColor : DEFAULT_BORDER_COLOR,
    selectColor : DEFAULT_SELECT_COLOR,
    separatorColor : DEFAULT_SEPARATOR_COLOR,
    backgroundColor : DEFAULT_BACKGROUND_COLOR,
    textColor : DEFAULT_TEXT_COLOR,
    renderLevel : true,
    renderTimestamp : true,
    paused: false
};
